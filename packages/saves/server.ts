import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { deflateRaw, deflateRawSync, inflateRawSync } from "node:zlib";
import { promisify } from "node:util";
const compress = promisify(deflateRaw);
export interface Envelope {
  format: 1 | 2;
  keyId: string;
  iv: string;
  tag: string;
  data: string;
}
function keyring() {
  const raw = process.env.SAVE_KEYS;
  if (!raw) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production")
      throw Error("SAVE_KEYS is required");
    return { "local-only": Buffer.alloc(32, 42) };
  }
  const keys = JSON.parse(raw) as Record<string, string>;
  const result: Record<string, Buffer> = Object.create(null);
  for (const [id, value] of Object.entries(keys)) {
    const key = Buffer.from(value, "base64");
    if (key.length !== 32) throw Error("Each save key must be 32 bytes");
    result[id] = key;
  }
  return result;
}
export function seal(value: unknown): Envelope {
  return encrypt(deflateRawSync(Buffer.from(JSON.stringify(value), "utf8")));
}
export async function sealAsync(value: unknown): Promise<Envelope> {
  return encrypt(await compress(Buffer.from(JSON.stringify(value), "utf8")));
}
function encrypt(compressed: Buffer): Envelope {
  const keys = keyring(),
    keyId = process.env.SAVE_CURRENT_KEY ?? Object.keys(keys)[0],
    key = keys[keyId];
  if (!key) throw Error("Save key is not configured");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("cyberpunk-save:2:" + keyId));
  const data = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return {
    format: 2,
    keyId,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}
export function unseal<T>(e: Envelope): T {
  if (
    (e.format !== 1 && e.format !== 2) ||
    typeof e.data !== "string" ||
    e.data.length > 16_000_000
  )
    throw Error("Unsupported save format");
  const key = keyring()[e.keyId];
  if (!key) throw Error("Save encryption key is unavailable");
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(e.iv, "base64"),
    );
    decipher.setAAD(Buffer.from(`cyberpunk-save:${e.format}:` + e.keyId));
    decipher.setAuthTag(Buffer.from(e.tag, "base64"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(e.data, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(
      (e.format === 2
        ? inflateRawSync(plain, { maxOutputLength: 32_000_000 })
        : plain
      ).toString("utf8"),
    ) as T;
  } catch {
    throw Error("This save is damaged or has been modified");
  }
}
