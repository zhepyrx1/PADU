import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

const resources = {
  classes: "classes",
  subjects: "subjects",
  exams: "exams",
  questions: "questions",
  students: "students",
  profiles: "profiles"
} as const;

type Resource = keyof typeof resources;

function table(resource: string) {
  if (!(resource in resources)) throw new Error("Resource tidak dikenal.");
  return resources[resource as Resource];
}

function scrub(resource: string, payload: Record<string, unknown>) {
  const clean = { ...payload };
  delete clean.id;
  if (resource === "profiles") delete clean.password_hash;
  return clean;
}

export async function GET(_: Request, { params }: { params: Promise<{ resource: string }> }) {
  const session = await getSession();
  if (!session || session.role === "student") return jsonError("Akses ditolak.", 403);

  try {
    const { resource } = await params;
    const columns = resource === "profiles" ? "id,username,full_name,role,is_active,created_at" : "*";
    const { data, error } = await supabaseAdmin.from(table(resource)).select(columns).limit(100).order("created_at", { ascending: false });
    if (error) return jsonError(error.message);
    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal memuat data.");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const session = await getSession();
  if (!session || !["admin", "teacher"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  try {
    const { resource } = await params;
    const payload = scrub(resource, await readJson<Record<string, unknown>>(request));
    const { data, error } = await supabaseAdmin.from(table(resource)).insert(payload).select().single();
    if (error) return jsonError(error.message);
    return NextResponse.json({ item: data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal menyimpan data.");
  }
}
