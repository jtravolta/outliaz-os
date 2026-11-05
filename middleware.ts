import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type ClaimsClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims: Record<string, unknown> } | null;
      error: unknown;
    }>;
  };
};

type ResponseSetter = (response: NextResponse) => void;
export type MiddlewareClientFactory = (
  request: NextRequest,
  setResponse: ResponseSetter,
) => ClaimsClient;

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/health",
  "/api/unsubscribe",
  "/ui-review",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
    || pathname.startsWith("/_next/")
    || pathname === "/favicon.ico"
    || pathname.startsWith("/u/");
}

function copyResponseState(source: NextResponse, target: NextResponse) {
  source.headers.forEach((value, key) => target.headers.set(key, value));
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie.name, cookie.value, cookie);
  }
  return target;
}

export function createMiddlewareCookieAdapter(
  request: NextRequest,
  setResponse: ResponseSetter,
) {
  let response = NextResponse.next({ request });
  const cookies: CookieMethodsServer = {
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet, headers) => {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      const replacement = NextResponse.next({ request });
      copyResponseState(response, replacement);
      for (const [key, value] of Object.entries(headers)) replacement.headers.set(key, value);
      for (const { name, value, options } of cookiesToSet) replacement.cookies.set(name, value, options);
      response = replacement;
      setResponse(response);
    },
  };
  return { cookies, getResponse: () => response };
}

function defaultClientFactory(request: NextRequest, setResponse: ResponseSetter): ClaimsClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase configuration is required");

  const adapter = createMiddlewareCookieAdapter(request, setResponse);
  setResponse(adapter.getResponse());
  return createServerClient(url, key, { cookies: adapter.cookies });
}

export async function updateSession(
  request: NextRequest,
  clientFactory: MiddlewareClientFactory = defaultClientFactory,
) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });
  let claims: Record<string, unknown> | null = null;
  try {
    const client = clientFactory(request, (replacement) => {
      response = copyResponseState(response, replacement);
    });
    const result = await client.auth.getClaims();
    claims = result.error ? null : result.data?.claims ?? null;
  } catch {
    claims = null;
  }

  if (!claims) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    return copyResponseState(response, redirect);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
