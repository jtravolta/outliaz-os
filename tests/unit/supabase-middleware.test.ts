import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest, NextResponse } from "next/server";

import { createMiddlewareCookieAdapter, updateSession } from "../../middleware";

const refreshedCookie = {
  name: "sb-access-token",
  value: "refreshed",
  options: { httpOnly: true, path: "/" },
};

test("production middleware cookie adapter forwards refreshed cookies to request and response", () => {
  const req = request("/dashboard", { existing: "old" });
  const responses: NextResponse[] = [];
  const adapter = createMiddlewareCookieAdapter(req, (response) => responses.push(response));

  assert.deepEqual(adapter.cookies.getAll(), [{ name: "existing", value: "old" }]);
  adapter.cookies.setAll!([refreshedCookie], { "cache-control": "private, no-store" });

  assert.equal(req.cookies.get(refreshedCookie.name)?.value, refreshedCookie.value);
  assert.equal(adapter.getResponse().cookies.get(refreshedCookie.name)?.value, refreshedCookie.value);
  assert.equal(adapter.getResponse().headers.get("cache-control"), "private, no-store");
  assert.equal(responses.at(-1)?.cookies.get(refreshedCookie.name)?.value, refreshedCookie.value);
});

function request(path: string, cookies: Record<string, string> = {}) {
  const url = new URL(path, "https://app.example.test");
  const headers = new Headers();
  for (const [name, value] of Object.entries(cookies)) headers.append("cookie", `${name}=${value}`);
  return new NextRequest(url, { headers });
}

test("refreshes cookies and preserves them and cache headers on a replacement response", async () => {
  const response = await updateSession(request("/dashboard"), (req, setResponse) => {
    setResponse(NextResponse.next({ request: req }));
    return {
      auth: {
        getClaims: async () => {
          setResponseCookie(setResponse, req);
          return { data: { claims: { sub: "user" } }, error: null };
        },
      },
    };
  });

  assert.equal(response.status, 200);
  assert.equal(response.cookies.get("sb-access-token")?.value, "refreshed");
});

test("leaves public auth and static paths reachable without an auth lookup", async () => {
  for (const path of ["/login", "/auth/callback?code=magic", "/ui-review", "/_next/static/chunk.js", "/favicon.ico"]) {
    let lookedUp = false;
    const response = await updateSession(request(path), () => {
      lookedUp = true;
      throw new Error("should not create an auth client");
    });
    assert.equal(response.status, 200, path);
    assert.equal(lookedUp, false, path);
  }
});

test("redirects protected paths when claims are absent or invalid", async () => {
  for (const result of [
    { data: null, error: null },
    { data: { claims: {} }, error: new Error("invalid") },
  ]) {
    const response = await updateSession(request("/dashboard"), (_req) => ({
      auth: { getClaims: async () => result },
    }));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://app.example.test/login");
  }
});

function setResponseCookie(
  setResponse: (response: NextResponse) => void,
  req: NextRequest,
) {
  const response = NextResponse.next({ request: req });
  response.headers.set("cache-control", "private, max-age=0");
  response.cookies.set(refreshedCookie.name, refreshedCookie.value, refreshedCookie.options);
  setResponse(response);
}
