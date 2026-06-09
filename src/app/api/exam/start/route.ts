import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

type ExamRow = {
  id: string;
  is_active: boolean;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
};

function jakartaNowKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}`;
}

function localDateTimeKey(value?: string | null) {
  if (!value) return "";
  return value.replace(" ", "T").slice(0, 19);
}

function keyToMs(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function secondsUntil(end: string, now: string) {
  return Math.max(0, Math.floor((keyToMs(end) - keyToMs(now)) / 1000));
}

export async function POST(request: Request) {
  const session = await getSession();
  const body = await readJson<{ examId?: string; participantId?: string; token?: string }>(request);
  if (!body.examId || !body.token) return jsonError("Exam dan token wajib diisi.");
  let studentId = session?.role === "student" ? session.studentId : null;

  if (!studentId && body.participantId) {
    const participant = await supabaseAdmin
      .from("exam_participants")
      .select("student_id")
      .eq("id", body.participantId)
      .eq("exam_id", body.examId)
      .maybeSingle();
    if (participant.error) return jsonError(participant.error.message);
    studentId = participant.data?.student_id ?? null;
  }

  if (!studentId) return jsonError("Akses siswa diperlukan. Silakan login ulang.", 403);

  const examResult = await supabaseAdmin
    .from("exams")
    .select("id,is_active,start_time,end_time,duration_minutes")
    .eq("id", body.examId)
    .maybeSingle<ExamRow>();
  if (examResult.error) return jsonError(examResult.error.message);
  const exam = examResult.data;
  if (!exam?.is_active) return jsonError("Asesmen belum aktif.");

  const now = jakartaNowKey();
  const start = localDateTimeKey(exam.start_time);
  const end = localDateTimeKey(exam.end_time);
  if (start && now < start) return jsonError(`Asesmen belum mulai. Jadwal mulai ${start.slice(11, 16)}.`);
  if (end && now > end) return jsonError(`Waktu asesmen sudah berakhir. Minta proktor klik Aktifkan Sekarang.`);

  const tokenResult = await supabaseAdmin
    .from("exam_tokens")
    .select("id,expires_at")
    .eq("exam_id", body.examId)
    .eq("token_type", "exam")
    .eq("token", body.token)
    .eq("is_active", true)
    .maybeSingle();
  if (tokenResult.error) return jsonError(tokenResult.error.message);
  if (!tokenResult.data) return jsonError("Token asesmen tidak valid.");
  const expiresAt = localDateTimeKey(tokenResult.data.expires_at);
  if (expiresAt && now > expiresAt) return jsonError("Token asesmen sudah kedaluwarsa.");

  const participantResult = await supabaseAdmin
    .from("exam_participants")
    .select("id,status,remaining_seconds")
    .eq("exam_id", body.examId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (participantResult.error) return jsonError(participantResult.error.message);
  if (!participantResult.data) return jsonError("Siswa tidak terdaftar pada asesmen ini.");
  if (participantResult.data.status === "locked") return jsonError("Asesmen terkunci. Masukkan token unlock dari proktor.");
  if (participantResult.data.status === "finished") return jsonError("Asesmen sudah selesai.");

  const scheduleRemainingSeconds = end ? secondsUntil(end, now) : Math.max(60, Number(exam.duration_minutes ?? 0) * 60);
  if (scheduleRemainingSeconds <= 0) return jsonError("Waktu asesmen sudah berakhir. Minta proktor klik Aktifkan Sekarang.");

  const updateResult = await supabaseAdmin
    .from("exam_participants")
    .update({
      status: "in_progress",
      remaining_seconds: scheduleRemainingSeconds
    })
    .eq("id", participantResult.data.id)
    .select("id,status,remaining_seconds")
    .single();

  if (updateResult.error) return jsonError(updateResult.error.message);
  return NextResponse.json({ participant: updateResult.data });
}
