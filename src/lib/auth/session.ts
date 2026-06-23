import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";

const COOKIE_NAME = "kajabi_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type AdminSessionUser = {
  id: string;
  email: string;
};

function getSecret() {
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("AUTH_COOKIE_SECRET must be set to a long random value.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encodeSessionPayload(payload: AdminSessionUser & { expiresAt: number }) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeSessionPayload(value: string) {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<
      AdminSessionUser & { expiresAt: number }
    >;
    if (!parsed.id || !parsed.email || !Number.isFinite(parsed.expiresAt)) return null;
    return parsed as AdminSessionUser & { expiresAt: number };
  } catch {
    return null;
  }
}

export async function createAdminSession(user: AdminSessionUser) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = encodeSessionPayload({ ...user, expiresAt });
  const token = `${payload}.${sign(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const session = decodeSessionPayload(payload);
  if (!session) return null;
  if (session.expiresAt <= Math.floor(Date.now() / 1000)) return null;

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  return {
    id: session.id,
    email: session.email,
    expiresAt: session.expiresAt,
  };
}

export async function isAuthenticated() {
  return Boolean(await getAdminSession());
}

export async function requireAdmin() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}

export async function requireAdminApi() {
  if (!(await isAuthenticated())) {
    return false;
  }
  return true;
}
