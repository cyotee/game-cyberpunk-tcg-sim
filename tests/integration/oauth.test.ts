import { it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { authRoute, user, localAuth } from "../../apps/service/auth";
import { db } from "../../apps/service/db";
process.env.LOCAL_DATABASE_PATH = "memory";
process.env.APP_ORIGIN = "https://table.example";
process.env.DISCORD_CLIENT_ID = "fake-client";
process.env.DISCORD_CLIENT_SECRET = "fake-secret";
it("completes PKCE OAuth, rejects state replay, and preserves identity across Discord name changes", async () => {
  let display = "Original name";
  let expectedChallenge = "";
  let exchanges = 0;
  vi.stubGlobal(
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://discord.com/api/oauth2/token") {
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("client_secret")).toBe("fake-secret");
        expect(body.get("redirect_uri")).toBe(
          "https://table.example/api?route=auth/callback",
        );
        expect(
          createHash("sha256")
            .update(body.get("code_verifier")!)
            .digest("base64url"),
        ).toBe(expectedChallenge);
        exchanges++;
        return Response.json({
          access_token: "fake-access",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "identify",
        });
      }
      if (url === "https://discord.com/api/users/@me")
        return Response.json({
          id: "123456789012345678",
          username: "discord-user",
          global_name: display,
        });
      throw Error("Unexpected external request");
    },
  );
  async function login() {
    const start = (await authRoute(
      new Request("https://table.example/api?route=auth/login&next=%2Fsaves"),
      "auth/login",
    ))!;
    expect(start.status).toBe(302);
    expect(start.headers.get("set-cookie")).toContain("Secure");
    const location = new URL(start.headers.get("location")!);
    expectedChallenge = location.searchParams.get("code_challenge")!;
    expect(location.searchParams.get("scope")).toBe("identify");
    const callback = new Request(
      "https://table.example/api?route=auth/callback&code=fake-code&state=" +
        location.searchParams.get("state"),
      { headers: { cookie: start.headers.get("set-cookie")!.split(";")[0] } },
    );
    const result = (await authRoute(callback, "auth/callback"))!;
    expect(result.headers.get("location")).toBe("https://table.example/saves");
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
    const cookie = result.headers.get("set-cookie")!.split(";")[0];
    const me = await user(
      new Request("https://table.example/api", { headers: { cookie } }),
    );
    await expect(authRoute(callback, "auth/callback")).rejects.toThrow(
      "expired",
    );
    return me!;
  }
  try {
    const first = await login();
    await (
      await db()
    ).query("UPDATE users SET blocks=$1 WHERE id=$2", [
      JSON.stringify(["blocked"]),
      first.id,
    ]);
    display = "Changed name";
    const second = await login();
    expect(second.id).toBe(first.id);
    expect(second.name).toBe(display);
    expect(second.blocks).toEqual(["blocked"]);
    expect(exchanges).toBe(2);
    await expect(
      authRoute(
        new Request("https://table.example/api?state=wrong"),
        "auth/callback",
      ),
    ).rejects.toThrow("state");
    expect(exchanges).toBe(2);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("disables development identity on Vercel even if DEV_AUTH is enabled", () => {
  const saved = { dev: process.env.DEV_AUTH, vercel: process.env.VERCEL };
  try {
    process.env.DEV_AUTH = "1";
    process.env.VERCEL = "1";
    expect(localAuth()).toBe(false);
  } finally {
    for (const [key, value] of [
      ["DEV_AUTH", saved.dev],
      ["VERCEL", saved.vercel],
    ])
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
  }
});
