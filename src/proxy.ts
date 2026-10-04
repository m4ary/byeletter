import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import {
  isValidApiKey,
  sessionPassword,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type SessionData,
} from "@/lib/auth-config";

/**
 * Everything except the unlock page/API and static assets requires the admin password.
 * API routes also accept `Authorization: Bearer <API_KEY>`.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const authorization = request.headers.get("authorization");
  if (pathname.startsWith("/api/") && authorization) {
    return isValidApiKey(authorization)
      ? NextResponse.next()
      : NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const sealed = request.cookies.get(SESSION_COOKIE)?.value;
  if (sealed) {
    const session = await unsealData<SessionData>(sealed, {
      password: sessionPassword(),
      ttl: SESSION_TTL_SECONDS,
    }).catch(() => ({}) as SessionData);
    if (session.admin) return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!unlock|api/unlock|_next/static|_next/image|favicon.ico).*)"],
};
