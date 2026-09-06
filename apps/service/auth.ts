import { randomBytes, createHash } from "node:crypto";
import * as oauth from "oauth4webapi";
import { db, transaction } from "./db";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export interface User {
  id: string;
  name: string;
  blocks: string[];
}
export const localAuth = () =>
  !process.env.VERCEL &&
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_AUTH === "1";
export const cookies = (req: Request) =>
  Object.fromEntries(
    (req.headers.get("cookie") ?? "")
      .split(";")
      .map((x) => x.trim().split("="))
      .filter((x) => x.length === 2),
  );
export function origin() {
  const o =
    process.env.APP_ORIGIN ?? (localAuth() ? "http://127.0.0.1:5173" : "");
  if (!o) throw Error("APP_ORIGIN is required");
  return o.replace(/\/$/, "");
}
export function sessionCookie(value: string, maxAge = 60 * 60 * 24 * 30) {
  return `session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${origin().startsWith("https:") ? "; Secure" : ""}`;
}
export async function user(req: Request): Promise<User | null> {
  const t = cookies(req).session;
  if (!t) return null;
  const result = await (
    await db()
  ).query<{ id: string; name: string; blocks: string[] }>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=$1 AND s.expires>$2`,
    [hash(t), Date.now()],
  );
  return result.rows[0] ?? null;
}
export async function requireUser(req: Request) {
  const u = await user(req);
  if (!u) throw Error("Sign in with Discord to continue");
  return u;
}
export async function login(id: string, name: string) {
  const session = token();
  await transaction(async (sql) => {
    await sql.query(
      "INSERT INTO users(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=$2",
      [id, name],
    );
    await sql.query(
      "INSERT INTO sessions(hash,user_id,expires) VALUES($1,$2,$3)",
      [hash(session), id, Date.now() + 30 * 86400000],
    );
  });
  return session;
}
const as: oauth.AuthorizationServer = {
  issuer: "https://discord.com",
  authorization_endpoint: "https://discord.com/oauth2/authorize",
  token_endpoint: "https://discord.com/api/oauth2/token",
};
export async function authRoute(
  req: Request,
  route: string,
): Promise<Response | undefined> {
  if (route === "auth/login") {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET)
      return Response.json(
        { error: "Discord login is not configured. See the deployment guide." },
        { status: 503 },
      );
    const state = oauth.generateRandomState(),
      verifier = oauth.generateRandomCodeVerifier(),
      url = new URL(req.url),
      next = url.searchParams.get("next") ?? "/";
    await (
      await db()
    ).query(
      "INSERT INTO oauth_states(hash,verifier,next_path,expires) VALUES($1,$2,$3,$4)",
      [
        hash(state),
        verifier,
        next.startsWith("/") && !next.startsWith("//") ? next : "/",
        Date.now() + 600000,
      ],
    );
    const auth = new URL(as.authorization_endpoint!);
    auth.search = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: origin() + "/api?route=auth/callback",
      response_type: "code",
      scope: "identify",
      state,
      code_challenge: await oauth.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
    }).toString();
    return new Response(null, {
      status: 302,
      headers: {
        Location: auth.href,
        "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${origin().startsWith("https:") ? "; Secure" : ""}`,
      },
    });
  }
  if (route === "auth/callback") {
    const url = new URL(req.url),
      state = url.searchParams.get("state");
    if (!state || state !== cookies(req).oauth_state)
      throw Error("Login state did not match; try again");
    const result = await (
      await db()
    ).query<{ verifier: string; next_path: string }>(
      "DELETE FROM oauth_states WHERE hash=$1 AND expires>$2 RETURNING verifier,next_path",
      [hash(state), Date.now()],
    );
    const saved = result.rows[0];
    if (!saved) throw Error("Login expired; try again");
    const client: oauth.Client = { client_id: process.env.DISCORD_CLIENT_ID! };
    const params = oauth.validateAuthResponse(as, client, url, state);
    const response = await oauth.authorizationCodeGrantRequest(
      as,
      client,
      oauth.ClientSecretPost(process.env.DISCORD_CLIENT_SECRET!),
      params,
      origin() + "/api?route=auth/callback",
      saved.verifier,
    );
    const tokens = await oauth.processAuthorizationCodeResponse(
      as,
      client,
      response,
    );
    const identity = await oauth.protectedResourceRequest(
      tokens.access_token,
      "GET",
      new URL("https://discord.com/api/users/@me"),
    );
    if (!identity.ok) throw Error("Discord identity lookup failed");
    const profile = (await identity.json()) as {
      id: string;
      global_name?: string;
      username: string;
    };
    if (!/^\d+$/.test(profile.id) || !profile.username)
      throw Error("Invalid Discord identity");
    const t = await login(
      profile.id,
      (profile.global_name ?? profile.username).slice(0, 80),
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: origin() + saved.next_path,
        "Set-Cookie": sessionCookie(t),
      },
    });
  }
  return undefined;
}
