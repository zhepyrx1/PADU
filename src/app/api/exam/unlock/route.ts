import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getSession();
  const body = await readJson<{ examId?: string; participantId?: string; token?: string }>(request);
  if (!body.examId || !body.participantId || !body.token) return jsonError("Data unlock tidak lengkap.");
  if (session && session.role !== "student") return jsonError("Akses siswa diperlukan.", 403);

  const participant = await supabaseAdmin
    .from("exam_participants")
    .select("id")
    .eq("id", body.participantId)
    .eq("exam_id", body.examId)
    .maybeSingle();
  if (participant.error) return jsonError(participant.error.message);
  if (!participant.data) return jsonError("Peserta tidak terdaftar pada asesmen ini.", 403);

  const { data, error } = await supabaseAdmin.rpc("validate_unlock_token", {
    p_exam_id: body.examId,
    p_participant_id: body.participantId,
    p_token: body.token
  });

  if (error) return jsonError(error.message);
  return NextResponse.json({ participant: data?.[0] });
}
