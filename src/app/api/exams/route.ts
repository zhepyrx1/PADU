import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

type CreateExamPayload = {
  subjectName?: string;
  title?: string;
  gradeLevel?: number;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  totalQuestions?: number;
  classIds?: string[];
};

type UpdateExamPayload = {
  examId?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
};

function subjectCode(name: string, gradeLevel: number) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "MAPEL";
  return `${base}${gradeLevel}${Math.floor(Math.random() * 900 + 100)}`.slice(0, 20);
}

function normalizedRole(role?: string) {
  return role?.trim().toLowerCase();
}

export async function GET() {
  const session = await getSession();
  if (!session || normalizedRole(session.role) === "student") return jsonError("Akses ditolak. Silakan login ulang sebagai proktor/admin.", 403);

  const { data, error } = await supabaseAdmin
    .from("exams")
    .select("id,title,grade_level,duration_minutes,total_questions,is_active,start_time,end_time,subjects(subject_name,subject_code)")
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message);
  return NextResponse.json({ exams: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "teacher", "proctor"].includes(normalizedRole(session.role) ?? "")) {
    return jsonError("Akses ditolak. Silakan login ulang sebagai proktor/admin.", 403);
  }

  const body = await readJson<CreateExamPayload>(request);
  const subjectName = body.subjectName?.trim();
  const title = body.title?.trim();
  const gradeLevel = Number(body.gradeLevel);
  const durationMinutes = Number(body.durationMinutes);
  const totalQuestions = Number(body.totalQuestions ?? 0);

  if (!subjectName) return jsonError("Nama mapel wajib diisi.");
  if (!title) return jsonError("Judul asesmen wajib diisi.");
  if (![10, 11, 12].includes(gradeLevel)) return jsonError("Kelas harus 10, 11, atau 12.");
  if (!body.startTime || !body.endTime) return jsonError("Jam mulai dan selesai wajib diisi.");
  if (!durationMinutes || durationMinutes < 1) return jsonError("Durasi wajib lebih dari 0 menit.");
  const requestedClassIds = Array.isArray(body.classIds) ? body.classIds.filter(Boolean) : [];
  if (requestedClassIds.length === 0) return jsonError("Pilih minimal 1 kelas/rombel peserta.");

  let subjectId: string | undefined;
  const existingSubject = await supabaseAdmin
    .from("subjects")
    .select("id")
    .eq("subject_name", subjectName)
    .maybeSingle();

  if (existingSubject.error) return jsonError(existingSubject.error.message);
  subjectId = existingSubject.data?.id;

  if (!subjectId) {
    const createdSubject = await supabaseAdmin
      .from("subjects")
      .insert({ subject_name: subjectName, subject_code: subjectCode(subjectName, gradeLevel) })
      .select("id")
      .single();
    if (createdSubject.error) return jsonError(createdSubject.error.message);
    subjectId = createdSubject.data.id;
  }

  const createdExam = await supabaseAdmin
    .from("exams")
    .insert({
      subject_id: subjectId,
      title,
      description: `Asesmen ${subjectName} kelas ${gradeLevel}`,
      grade_level: gradeLevel,
      start_time: body.startTime,
      end_time: body.endTime,
      duration_minutes: durationMinutes,
      total_questions: totalQuestions,
      is_active: false,
      created_by: session.id
    })
    .select("id,title,grade_level,duration_minutes,total_questions,is_active,start_time,end_time,subjects(subject_name,subject_code)")
    .single();

  if (createdExam.error) return jsonError(createdExam.error.message);

  const classes = await supabaseAdmin.from("classes").select("id").eq("grade_level", gradeLevel).in("id", requestedClassIds);
  if (classes.error) return jsonError(classes.error.message);
  const classIds = (classes.data ?? []).map((item) => item.id);
  if (classIds.length === 0) return jsonError("Kelas yang dipilih tidak cocok dengan tingkat kelas asesmen.");

  let participantCount = 0;
  if (classIds.length > 0) {
    const students = await supabaseAdmin.from("students").select("id").in("class_id", classIds);
    if (students.error) return jsonError(students.error.message);
    const participants = (students.data ?? []).map((student) => ({ exam_id: createdExam.data.id, student_id: student.id }));
    participantCount = participants.length;
    if (participants.length > 0) {
      const insertedParticipants = await supabaseAdmin.from("exam_participants").insert(participants);
      if (insertedParticipants.error) return jsonError(insertedParticipants.error.message);
    }
  }

  return NextResponse.json({ exam: createdExam.data, participantCount });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "teacher", "proctor"].includes(normalizedRole(session.role) ?? "")) {
    return jsonError("Akses ditolak. Silakan login ulang sebagai proktor/admin.", 403);
  }

  const body = await readJson<UpdateExamPayload>(request);
  if (!body.examId) return jsonError("examId wajib diisi.");
  if (!body.startTime || !body.endTime) return jsonError("Jam mulai dan selesai wajib diisi.");

  const durationMinutes = Number(body.durationMinutes ?? 0);
  const payload: Record<string, string | number | boolean> = {
    start_time: body.startTime,
    end_time: body.endTime,
    is_active: true
  };
  if (durationMinutes > 0) payload.duration_minutes = durationMinutes;

  const { data, error } = await supabaseAdmin
    .from("exams")
    .update(payload)
    .eq("id", body.examId)
    .select("id,title,grade_level,duration_minutes,total_questions,is_active,start_time,end_time,subjects(subject_name,subject_code)")
    .single();

  if (error) return jsonError(error.message);
  return NextResponse.json({ exam: data });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "teacher", "proctor"].includes(normalizedRole(session.role) ?? "")) {
    return jsonError("Akses ditolak. Silakan login ulang sebagai proktor/admin.", 403);
  }

  const examId = new URL(request.url).searchParams.get("examId");
  if (!examId) return jsonError("examId wajib diisi.");

  const { error } = await supabaseAdmin.from("exams").delete().eq("id", examId);
  if (error) return jsonError(error.message);

  return NextResponse.json({ ok: true });
}
