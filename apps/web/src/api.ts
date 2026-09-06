import { PROTOCOL_VERSION } from "../../../packages/protocol/version";
export async function api<T = any>(
  route: string,
  body?: unknown,
  code?: string,
  extra: Record<string, string> = {},
): Promise<T> {
  const params = new URLSearchParams({ route, ...extra });
  if (code) params.set("code", code);
  const connection = code ? sessionStorage.getItem("seat:" + code) : null;
  const res = await fetch("/api?" + params, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body !== undefined
        ? { "Content-Type": "application/json", "X-Table-Request": "1" }
        : {}),
      ...(connection ? { "X-Seat-Connection": connection } : {}),
    },
    ...(body !== undefined
      ? {
          body: JSON.stringify(
            route === "action"
              ? { ...(body as object), protocolVersion: PROTOCOL_VERSION }
              : body,
          ),
        }
      : {}),
  });
  const result = await res.json();
  if (!res.ok) throw Error(result.error ?? "Request failed");
  return result as T;
}
