import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function scheduleDate(value?: string) {
  return value?.slice(0, 10);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "student" || !session.studentId) return jsonError("Akses siswa diperlukan.", 403);
  const mode = new URL(request.url).searchParams.get("mode") === "tka" ? "tka" : "asesmen";

  const { data, error } = await supabaseAdmin
    .from("exam_participants")
    .select("id,status,remaining_seconds,final_score,exams(id,title,grade_level,duration_minutes,total_questions,is_active,start_time,end_time,subjects(subject_name,subject_code))")
    .eq("student_id", session.studentId)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message);
  const today = jakartaToday();
  const visible = (data ?? []).filter((item) => {
    const exam = Array.isArray(item.exams) ? item.exams[0] : item.exams;
    if (!exam?.is_active) return false;
    const subject = Array.isArray(exam.subjects) ? exam.subjects[0] : exam.subjects;
    const title = `${exam.title ?? ""} ${subject?.subject_name ?? ""}`.toLowerCase();
    const isTka = title.includes("tka") || title.includes("tes kemampuan akademik");
    if (mode === "tka" && !isTka) return false;
    if (mode === "asesmen" && isTka) return false;
    return scheduleDate(exam.start_time) === today;
  });

  const examIds = [...new Set(visible.map((item) => {
    const exam = Array.isArray(item.exams) ? item.exams[0] : item.exams;
    return exam?.id;
  }).filter(Boolean))] as string[];
  const participantIds = visible.map((item) => item.id);

  const [questionsResult, answersResult] = await Promise.all([
    examIds.length
      ? supabaseAdmin.from("questions").select("id,exam_id").in("exam_id", examIds)
      : Promise.resolve({ data: [], error: null }),
    participantIds.length
      ? supabaseAdmin.from("student_answers").select("participant_id,question_id,is_correct").in("participant_id", participantIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (questionsResult.error) return jsonError(questionsResult.error.message);
  if (answersResult.error) return jsonError(answersResult.error.message);

  const questionCountByExam = new Map<string, number>();
  (questionsResult.data ?? []).forEach((question) => {
    questionCountByExam.set(question.exam_id, (questionCountByExam.get(question.exam_id) ?? 0) + 1);
  });

  const answersByParticipant = new Map<string, { question_id: string; is_correct?: boolean | null }[]>();
  (answersResult.data ?? []).forEach((answer) => {
    answersByParticipant.set(answer.participant_id, [...(answersByParticipant.get(answer.participant_id) ?? []), answer]);
  });

  const exams = visible.map((item) => {
    const exam = Array.isArray(item.exams) ? item.exams[0] : item.exams;
    const answers = answersByParticipant.get(item.id) ?? [];
    const correctCount = answers.filter((answer) => answer.is_correct === true).length;
    const totalQuestions = questionCountByExam.get(exam?.id ?? "") ?? exam?.total_questions ?? 0;
    const emptyCount = Math.max(0, totalQuestions - answers.length);
    const wrongCount = Math.max(0, totalQuestions - correctCount - emptyCount);
    return {
      ...item,
      result: item.status === "finished" ? {
        final_score: item.final_score ?? 0,
        correct_count: correctCount,
        wrong_count: wrongCount,
        empty_count: emptyCount
      } : null
    };
  });

  return NextResponse.json({ student: session, exams });
}
