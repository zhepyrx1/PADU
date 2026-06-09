import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Akses ditolak.", 403);
  const examId = new URL(request.url).searchParams.get("examId");
  if (!examId) return jsonError("examId wajib diisi.");

  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("id,question_text,question_type,media_type,media_url,score,order_number,question_options(option_label,option_text,order_number),question_answer_keys(answer_key)")
    .eq("exam_id", examId)
    .order("order_number", { ascending: true });

  if (error) return jsonError(error.message);
  const questions = (data ?? []).map((question) => {
    const mediaUrl = question.media_url
      ? supabaseAdmin.storage.from("question-images").getPublicUrl(question.media_url).data.publicUrl || question.media_url
      : question.media_url;
    if (question.question_type !== "matching") return { ...question, media_url: mediaUrl };
    const pairs = Array.isArray(question.question_answer_keys?.[0]?.answer_key?.pairs)
      ? question.question_answer_keys[0].answer_key.pairs
      : [];
    const left = pairs.map((pair: { left?: string }, index: number) => ({
      id: `left-${index + 1}`,
      text: pair.left ?? ""
    })).filter((item: { text: string }) => item.text.trim());
    const right = pairs.map((pair: { right?: string }, index: number) => ({
      id: `right-${index + 1}`,
      text: pair.right ?? ""
    })).filter((item: { text: string }) => item.text.trim());
    const split = Math.ceil(right.length / 2);
    return {
      ...question,
      media_url: mediaUrl,
      question_answer_keys: undefined,
      matching_items: {
        left,
        right: [...right.slice(split), ...right.slice(0, split)]
      }
    };
  });
  return NextResponse.json({ questions });
}
