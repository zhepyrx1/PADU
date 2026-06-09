import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

function isMissingCreatedBy(error?: { message?: string } | null) {
  return Boolean(error?.message?.toLowerCase().includes("created_by"));
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "teacher"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  const examId = new URL(request.url).searchParams.get("examId");
  if (!examId) return jsonError("examId wajib diisi.");

  let questionsResult: Awaited<ReturnType<typeof supabaseAdmin.from>> | any = await supabaseAdmin
    .from("questions")
    .select("id,question_text,question_type,score,order_number,created_by,question_options(option_label,option_text,is_correct,order_number),question_answer_keys(answer_key)")
    .eq("exam_id", examId)
    .order("order_number", { ascending: true });

  if (isMissingCreatedBy(questionsResult.error)) {
    questionsResult = await supabaseAdmin
      .from("questions")
      .select("id,question_text,question_type,score,order_number,question_options(option_label,option_text,is_correct,order_number),question_answer_keys(answer_key)")
      .eq("exam_id", examId)
      .order("order_number", { ascending: true });
  }

  const participantsResult = await
    supabaseAdmin
      .from("exam_participants")
      .select("id,status,final_score,students(room_name,profiles(full_name),classes(class_name)),student_answers(question_id,answer,is_correct,score_obtained)")
      .eq("exam_id", examId)
      .order("created_at", { ascending: true });

  if (questionsResult.error) return jsonError(questionsResult.error.message);
  if (participantsResult.error) return jsonError(participantsResult.error.message);

  const questions = session.role === "teacher"
    ? (questionsResult.data ?? []).filter((question: { id: string; created_by?: string | null }) => !("created_by" in question) || question.created_by === session.id)
    : (questionsResult.data ?? []);
  const visibleQuestionIds = new Set(questions.map((question: { id: string }) => question.id));
  const participants = (participantsResult.data ?? []).map((participant) => ({
    ...participant,
    student_answers: (participant.student_answers ?? []).filter((answer) => visibleQuestionIds.has(answer.question_id))
  }));

  return NextResponse.json({
    questions,
    participants
  });
}
