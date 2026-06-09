import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "proctor", "teacher"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  const examId = new URL(request.url).searchParams.get("examId");
  if (!examId) return jsonError("examId wajib diisi.");

  const { data, error } = await supabaseAdmin
    .from("exam_participants")
    .select("id,status,final_score,students(nis,room_name,profiles(full_name),classes(class_name)),student_answers(id)")
    .eq("exam_id", examId)
    .limit(1000);

  if (error) return jsonError(error.message);

  const rows = data ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ counts, rows });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "proctor"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  const body = await request.json() as { participantId?: string; action?: "repeat" };
  if (!body.participantId) return jsonError("participantId wajib diisi.");
  if (body.action !== "repeat") return jsonError("Aksi tidak dikenal.");

  const deletedAnswers = await supabaseAdmin.from("student_answers").delete().eq("participant_id", body.participantId);
  if (deletedAnswers.error) return jsonError(deletedAnswers.error.message);

  const updated = await supabaseAdmin
    .from("exam_participants")
    .update({
      status: "not_started",
      final_score: null,
      remaining_seconds: null
    })
    .eq("id", body.participantId)
    .select("id,status,final_score")
    .single();

  if (updated.error) return jsonError(updated.error.message);
  return NextResponse.json({ participant: updated.data });
}
