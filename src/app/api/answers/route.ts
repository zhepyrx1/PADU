import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getSession();
  const body = await readJson<{ participantId?: string; questionId?: string; answer?: unknown; logEvent?: boolean }>(request);
  if (!body.participantId || !body.questionId) return jsonError("participantId dan questionId wajib diisi.");

  const participantResult = await supabaseAdmin
    .from("exam_participants")
    .select("id,student_id")
    .eq("id", body.participantId)
    .maybeSingle();

  if (participantResult.error) return jsonError(participantResult.error.message);
  const participant = participantResult.data;
  if (!participant) return jsonError("Peserta tidak ditemukan.", 404);
  if (session?.role === "student" && session.studentId && participant.student_id !== session.studentId) {
    return jsonError("Akses siswa diperlukan.", 403);
  }

  const { data, error } = await supabaseAdmin.rpc("save_student_answer", {
    p_participant_id: body.participantId,
    p_question_id: body.questionId,
    p_answer: body.answer ?? {},
    p_log_event: body.logEvent ?? false
  });

  if (error) return jsonError(error.message);
  return NextResponse.json({ answer: data });
}
