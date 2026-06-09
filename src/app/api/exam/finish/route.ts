import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

type QuestionRow = {
  id: string;
  question_type?: string | null;
  score?: number | null;
  question_options?: { option_label?: string | null; is_correct?: boolean | null }[] | null;
  question_answer_keys?: { answer_key?: { answers?: string[]; pairs?: { left?: string; right?: string }[] } | null }[] | null;
};

type AnswerRow = {
  id: string;
  question_id: string;
  answer?: { option?: string; text?: string; pairs?: Record<string, string> } | null;
  is_correct?: boolean | null;
  score_obtained?: number | null;
};

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?()[\]{}"'`]/g, "")
    .replace(/\s+/g, " ");
}

function answerHasValue(answer: AnswerRow) {
  if (answer.answer?.pairs) {
    return Object.values(answer.answer.pairs).some((value) => normalizeText(value).length > 0);
  }
  return [answer.answer?.option, answer.answer?.text].some((value) => normalizeText(value).length > 0);
}

function isCorrectAnswer(question: QuestionRow, answer: AnswerRow) {
  if (question.question_type === "multiple_choice") {
    const selected = answer.answer?.option;
    return question.question_options?.some((option) => option.option_label === selected && option.is_correct === true) ?? false;
  }

  const key = question.question_answer_keys?.[0]?.answer_key;
  if (question.question_type === "short_answer") {
    const submitted = normalizeText(answer.answer?.text);
    return (key?.answers ?? []).some((value) => normalizeText(value) === submitted);
  }

  if (question.question_type === "matching") {
    const pairs = key?.pairs ?? [];
    if (pairs.length === 0) return false;
    const submittedPairs = answer.answer?.pairs ?? {};
    return pairs.every((pair) => {
      const left = pair.left ?? "";
      const right = pair.right ?? "";
      return normalizeText(submittedPairs[left]) === normalizeText(right);
    });
  }

  return false;
}

export async function POST(request: Request) {
  const session = await getSession();
  const body = await readJson<{ participantId?: string }>(request);
  if (!body.participantId) return jsonError("participantId wajib diisi.");

  const participantResult = await supabaseAdmin
    .from("exam_participants")
    .select("id,exam_id,student_id")
    .eq("id", body.participantId)
    .maybeSingle();
  if (participantResult.error) return jsonError(participantResult.error.message);
  const participant = participantResult.data;
  if (!participant) return jsonError("Peserta tidak ditemukan.", 404);
  if (session?.role === "student" && session.studentId && participant.student_id !== session.studentId) {
    return jsonError("Akses siswa diperlukan.", 403);
  }

  const [questionsResult, answersResult] = await Promise.all([
    supabaseAdmin
      .from("questions")
      .select("id,question_type,score,question_options(option_label,is_correct),question_answer_keys(answer_key)")
      .eq("exam_id", participant.exam_id)
      .returns<QuestionRow[]>(),
    supabaseAdmin
      .from("student_answers")
      .select("id,question_id,answer,is_correct,score_obtained")
      .eq("participant_id", participant.id)
      .returns<AnswerRow[]>()
  ]);

  if (questionsResult.error) return jsonError(questionsResult.error.message);
  if (answersResult.error) return jsonError(answersResult.error.message);

  const questions = questionsResult.data ?? [];
  const answers = answersResult.data ?? [];
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const gradedAnswers = answers.map((answer) => {
    const question = questionById.get(answer.question_id);
    const isCorrect = question && answerHasValue(answer) ? isCorrectAnswer(question, answer) : false;
    return {
      ...answer,
      is_correct: isCorrect,
      score_obtained: isCorrect ? Number(question?.score ?? 1) : 0
    };
  });

  await Promise.all(gradedAnswers.map((answer) => supabaseAdmin
    .from("student_answers")
    .update({ is_correct: answer.is_correct, score_obtained: answer.score_obtained })
    .eq("id", answer.id)
  ));

  const answeredQuestionIds = new Set(gradedAnswers.filter(answerHasValue).map((answer) => answer.question_id));
  const correctCount = gradedAnswers.filter((answer) => answer.is_correct === true).length;
  const emptyCount = questions.filter((question) => !answeredQuestionIds.has(question.id)).length;
  const wrongCount = Math.max(0, questions.length - correctCount - emptyCount);
  const finalScore = gradedAnswers.reduce((total, answer) => total + Number(answer.score_obtained ?? 0), 0);

  const updateResult = await supabaseAdmin
    .from("exam_participants")
    .update({
      status: "finished",
      final_score: finalScore,
      remaining_seconds: 0
    })
    .eq("id", participant.id);

  if (updateResult.error) return jsonError(updateResult.error.message);

  return NextResponse.json({
    result: {
      final_score: finalScore,
      correct_count: correctCount,
      wrong_count: wrongCount,
      empty_count: emptyCount
    }
  });
}
