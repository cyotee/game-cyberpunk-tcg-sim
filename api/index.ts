import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "../apps/service/api";
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    let body = "";
    const parsed = (req as IncomingMessage & { body?: unknown }).body;
    if (parsed !== undefined)
      body = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 20_000_000) {
        res.writeHead(413);
        res.end("Request too large");
        return;
      }
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value)
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    const request = new Request(
      (process.env.APP_ORIGIN ?? "http://127.0.0.1:5173") + (req.url ?? "/api"),
      { method: req.method, headers, ...(body ? { body } : {}) },
    );
    const response = await handle(request);
    res.statusCode = response.status;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    for (const [key, value] of response.headers) res.setHeader(key, value);
    res.end(await response.text());
  } catch {
    res.statusCode = 500;
    res.end(
      JSON.stringify({ error: "The service could not process this request" }),
    );
  }
}
