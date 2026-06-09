import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "student") return jsonError("Akses siswa diperlukan.", 403);
  const body = await readJson<{ participantId?: string; reason?: string }>(request);
  if (!body.participantId) return jsonError("participantId wajib diisi.");

  const { error } = await supabaseAdmin.rpc("lock_participant", {
    p_participant_id: body.participantId,
    p_reason: body.reason ?? "Keluar aplikasi"
  });
  if (error) return jsonError(error.message);
  return NextResponse.json({ ok: true });
}
