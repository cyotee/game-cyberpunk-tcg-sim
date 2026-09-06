import { z } from "zod";
import { db } from "./db";
import {
  authRoute,
  user,
  requireUser,
  localAuth,
  login,
  sessionCookie,
  cookies,
  hash,
  origin,
} from "./auth";
import * as rooms from "./rooms";
const roomInput = z.object({
  name: z.string().trim().min(1).max(80),
  private: z.boolean(),
  capacity: z.number().int().min(2).max(5),
  targetMode: z.enum(["majority", "seven", "custom"]),
  customTarget: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});
const settingsInput = roomInput.pick({ targetMode: true, customTarget: true });
export async function handle(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url),
      route = url.searchParams.get("route") ?? "health";
    if (route === "health")
      return Response.json({
        ok: true,
        discord: !!process.env.DISCORD_CLIENT_ID,
        localAuth: localAuth(),
      });
    if (req.method !== "GET") {
      if (
        req.headers.get("x-table-request") !== "1" ||
        req.headers.get("origin") !== origin()
      )
        return Response.json(
          { error: "Request origin rejected" },
          { status: 403 },
        );
    }
    const auth = await authRoute(req, route);
    if (auth) return auth;
    if (route === "me")
      return Response.json({
        user: await user(req),
        localAuth: localAuth(),
        discord: !!process.env.DISCORD_CLIENT_ID,
      });
    if (route === "tables" && req.method === "GET")
      return Response.json({ tables: await rooms.publicTables() });
    if (
      req.method === "POST" &&
      Number(req.headers.get("content-length")) > 20_000_000
    )
      throw Error("Request too large");
    const body = req.method === "POST" ? await req.json() : {};
    if (route === "auth/local" && req.method === "POST" && localAuth()) {
      const input = z
        .object({ name: z.string().trim().min(1).max(40) })
        .parse(body);
      const id = "local:" + hash(input.name).slice(0, 24);
      const t = await login(id, input.name);
      return Response.json(
        { ok: true },
        { headers: { "Set-Cookie": sessionCookie(t) } },
      );
    }
    const u = await requireUser(req);
    if (route === "auth/logout" && req.method === "POST") {
      await (
        await db()
      ).query("DELETE FROM sessions WHERE hash=$1", [
        hash(cookies(req).session ?? ""),
      ]);
      return Response.json(
        { ok: true },
        { headers: { "Set-Cookie": sessionCookie("", 0) } },
      );
    }
    if (route === "blocks") {
      if (req.method === "POST") {
        const input = z.object({ id: z.string().min(1).max(100) }).parse(body);
        await (
          await db()
        ).query("UPDATE users SET blocks=blocks-$1 WHERE id=$2", [
          input.id,
          u.id,
        ]);
      }
      const r = await (
        await db()
      ).query<{ id: string; name: string }>(
        "SELECT id,name FROM users WHERE id IN (SELECT jsonb_array_elements_text(blocks) FROM users WHERE id=$1)",
        [u.id],
      );
      return Response.json({ blocks: r.rows });
    }
    if (route === "tables" && req.method === "POST")
      return Response.json(await rooms.createRoom(u, roomInput.parse(body)));
    if (route === "restore" && req.method === "POST")
      return Response.json(await rooms.restore(u, body.envelope));
    const code = z
      .string()
      .regex(/^[A-F0-9]{12}$/)
      .parse(url.searchParams.get("code"));
    const connection = req.headers.get("x-seat-connection") ?? undefined;
    if (route === "join" && req.method === "POST")
      return Response.json(await rooms.joinRoom(code, u));
    if (route === "room" && req.method === "GET")
      return Response.json(
        await rooms.pollRoom(
          code,
          u,
          connection,
          url.searchParams.get("since") ?? undefined,
          url.searchParams.get("presence") === "1",
        ),
      );
    if (route === "history" && req.method === "GET") {
      const before = url.searchParams.has("before")
        ? z.coerce
            .number()
            .int()
            .positive()
            .safe()
            .parse(url.searchParams.get("before"))
        : undefined;
      return Response.json(
        await rooms.historyPage(code, u, connection, before),
      );
    }
    if (route === "action" && req.method === "POST")
      return Response.json(await rooms.roomAction(code, u, connection, body));
    if (route === "deck" && req.method === "POST")
      return Response.json(await rooms.setDeck(code, u, connection, body));
    if (route === "settings" && req.method === "POST")
      return Response.json(
        await rooms.settings(code, u, connection, settingsInput.parse(body)),
      );
    if (route === "leave" && req.method === "POST")
      return Response.json(await rooms.leave(code, u, connection));
    if (route === "checkpoint" && req.method === "POST")
      return Response.json(await rooms.checkpoint(code, u, connection));
    return Response.json({ error: "Unknown endpoint" }, { status: 404 });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Invalid request fields"
        : error instanceof Error
          ? error.message
          : "Request failed";
    return Response.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
