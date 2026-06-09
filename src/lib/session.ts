import crypto from "crypto";
import { cookies } from "next/headers";

export type AppRole = "student" | "teacher" | "proctor" | "admin";

export type AppSession = {
  id: string;
  username: string;
  fullName: string;
  role: AppRole;
  studentId?: string | null;
  nis?: string | null;
  className?: string | null;
  roomName?: string | null;
};

const cookieName = "padu_session";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return value;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(session: AppSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value?: string): AppSession | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AppSession;
}

export async function setSession(session: AppSession) {
  const jar = await cookies();
  jar.set(cookieName, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function getSession() {
  const jar = await cookies();
  return decodeSession(jar.get(cookieName)?.value);
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(cookieName);
}

export function assertDashboardRole(session: AppSession | null) {
  if (!session || session.role === "student") return null;
  return session;
}
