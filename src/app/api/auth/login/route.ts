import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { setSession, type AppRole } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

type LoginPayload = {
  username?: string;
  password?: string;
  app?: "dashboard" | "mobile";
};

export async function POST(request: Request) {
  try {
    const body = await readJson<LoginPayload>(request);
    if (!body.username || !body.password) return jsonError("Username dan password wajib diisi.");
    const allowedRoles = body.app === "mobile" ? ["student"] : ["admin", "teacher", "proctor"];

    const { data, error } = await supabaseAdmin.rpc("authenticate_profile", {
      p_username: body.username,
      p_password: body.password,
      p_allowed_roles: allowedRoles
    });

    if (error) return jsonError(error.message);
    const user = data?.[0];
    if (!user) return jsonError("Akun tidak ditemukan, tidak aktif, atau role tidak sesuai.", 401);

    const session = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role as AppRole,
      studentId: user.student_id,
      nis: user.nis,
      className: user.class_name,
      roomName: user.room_name
    };

    await setSession(session);
    return NextResponse.json({ user: session });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Login gagal.");
  }
}
