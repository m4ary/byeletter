import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { getIronSession } from "iron-session";
import {
  adminPassword,
  cookieSecure,
  isValidApiKey,
  sessionPassword,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type SessionData,
} from "./auth-config";
import { NextResponse } from "next/server";

export type { SessionData };

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), {
    password: sessionPassword(),
    cookieName: SESSION_COOKIE,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      sameSite: "strict",
      secure: cookieSecure(),
      path: "/",
    },
  });
}

export async function isAdmin(): Promise<boolean> {
  return Boolean((await getSession()).admin);
}

/**
 * For route handlers: null when the request is unlocked (admin session cookie, or a valid
 * `Authorization: Bearer <API_KEY>` header), otherwise a 401 response. The proxy checks too.
 */
export async function denyUnlessAdmin(): Promise<NextResponse | null> {
  const authorization = (await headers()).get("authorization");
  if (authorization) {
    return isValidApiKey(authorization) ? null : NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }
  return (await isAdmin()) ? null : NextResponse.json({ error: "Locked" }, { status: 401 });
}

export function checkAdminPassword(candidate: string): boolean {
  const expected = adminPassword();
  if (!expected) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
