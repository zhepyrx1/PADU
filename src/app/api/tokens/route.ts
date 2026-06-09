import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

type Payload = {
  examId?: string;
  tokenType?: "exam" | "unlock";
  expiresAt?: string | null;
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "proctor", "teacher"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  const examId = new URL(request.url).searchParams.get("examId");
  if (!examId) return jsonError("examId wajib diisi.");

  const { data, error } = await supabaseAdmin
    .from("exam_tokens")
    .select("id,token,token_type,is_active,expires_at,created_at")
    .eq("exam_id", examId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message);
  return NextResponse.json({ tokens: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "proctor"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  const body = await readJson<Payload>(request);
  if (!body.examId || !body.tokenType) return jsonError("examId dan tokenType wajib diisi.");

  const { data, error } = await supabaseAdmin.rpc("create_exam_token", {
    p_exam_id: body.examId,
    p_token_type: body.tokenType,
    p_created_by: session.id,
    p_expires_at: body.expiresAt ?? null
  });

  if (error) return jsonError(error.message);
  return NextResponse.json({ token: data?.[0] });
}
