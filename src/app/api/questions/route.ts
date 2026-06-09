import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

type OptionInput = {
  label: string;
  text: string;
  isCorrect?: boolean;
};

type PairInput = {
  left: string;
  right: string;
};

type QuestionPayload = {
  examId?: string;
  questionText?: string;
  questionType?: "multiple_choice" | "short_answer" | "matching" | "ordering" | "hotspot" | "case_study" | "code";
  score?: number;
  orderNumber?: number;
  mediaPath?: string | null;
  options?: OptionInput[];
  shortAnswers?: string[];
  pairs?: PairInput[];
};

function isMissingCreatedBy(error?: { message?: string } | null) {
  return Boolean(error?.message?.toLowerCase().includes("created_by"));
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "teacher"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  const examId = new URL(request.url).searchParams.get("examId");
  if (!examId) return jsonError("examId wajib diisi.");

  let result: Awaited<ReturnType<typeof supabaseAdmin.from>> | any = await supabaseAdmin
    .from("questions")
    .select("id,question_text,question_type,score,order_number,created_by")
    .eq("exam_id", examId)
    .order("order_number", { ascending: true });

  if (isMissingCreatedBy(result.error)) {
    result = await supabaseAdmin
      .from("questions")
      .select("id,question_text,question_type,score,order_number")
      .eq("exam_id", examId)
      .order("order_number", { ascending: true });
  }

  if (result.error) return jsonError(result.error.message);
  const questions = session.role === "teacher" && !isMissingCreatedBy(result.error)
    ? (result.data ?? []).filter((question: { created_by?: string | null }) => !("created_by" in question) || question.created_by === session.id)
    : (result.data ?? []);
  return NextResponse.json({ questions });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "teacher"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  try {
    const body = await readJson<QuestionPayload>(request);
    if (!body.examId) return jsonError("Pilih asesmen terlebih dahulu.");
    if (!body.questionText?.trim()) return jsonError("Pertanyaan wajib diisi.");
    if (!body.questionType) return jsonError("Jenis soal wajib dipilih.");

    let inserted = await supabaseAdmin
      .from("questions")
      .insert({
        exam_id: body.examId,
        question_text: body.questionText.trim(),
        question_type: body.questionType,
        media_type: body.mediaPath ? "image" : null,
        media_url: body.mediaPath || null,
        score: body.score ?? 1,
        order_number: body.orderNumber ?? null,
        created_by: session.id
      })
      .select()
      .single();

    if (isMissingCreatedBy(inserted.error)) {
      inserted = await supabaseAdmin
        .from("questions")
        .insert({
          exam_id: body.examId,
          question_text: body.questionText.trim(),
          question_type: body.questionType,
          media_type: body.mediaPath ? "image" : null,
          media_url: body.mediaPath || null,
          score: body.score ?? 1,
          order_number: body.orderNumber ?? null
        })
        .select()
        .single();
    }

    if (inserted.error) return jsonError(inserted.error.message);
    const question = inserted.data;

    if (body.questionType === "multiple_choice") {
      const options = (body.options ?? []).filter((option) => option.text.trim());
      if (options.length < 2) return jsonError("Pilihan ganda minimal punya 2 opsi.");

      const { error } = await supabaseAdmin.from("question_options").insert(
        options.map((option, index) => ({
          question_id: question.id,
          option_label: option.label,
          option_text: option.text.trim(),
          is_correct: option.isCorrect ?? false,
          order_number: index + 1
        }))
      );
      if (error) return jsonError(error.message);
    }

    if (body.questionType === "short_answer") {
      const answers = (body.shortAnswers ?? []).map((answer) => answer.trim()).filter(Boolean);
      if (answers.length === 0) return jsonError("Isian singkat minimal punya 1 jawaban benar.");
      const { error } = await supabaseAdmin.from("question_answer_keys").insert({
        question_id: question.id,
        answer_key: { answers }
      });
      if (error) return jsonError(error.message);
    }

    if (body.questionType === "matching") {
      const pairs = (body.pairs ?? []).filter((pair) => pair.left.trim() && pair.right.trim());
      if (pairs.length === 0) return jsonError("Soal mencocokkan minimal punya 1 pasangan.");
      const { error } = await supabaseAdmin.from("question_answer_keys").insert({
        question_id: question.id,
        answer_key: { pairs }
      });
      if (error) return jsonError(error.message);
    }

    return NextResponse.json({ question });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal menyimpan soal.");
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "teacher"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  const questionId = new URL(request.url).searchParams.get("questionId");
  if (!questionId) return jsonError("questionId wajib diisi.");

  if (session.role === "teacher") {
    const ownerResult = await supabaseAdmin.from("questions").select("created_by").eq("id", questionId).maybeSingle();
    if (!isMissingCreatedBy(ownerResult.error) && ownerResult.data?.created_by && ownerResult.data.created_by !== session.id) {
      return jsonError("Soal ini milik guru lain.", 403);
    }
  }

  const { error } = await supabaseAdmin.from("questions").delete().eq("id", questionId);
  if (error) return jsonError(error.message);

  return NextResponse.json({ ok: true });
}
