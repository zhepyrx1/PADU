import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getSession();
  if (!session || session.role === "student") return jsonError("Akses ditolak.", 403);

  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id,class_name,grade_level,major")
    .order("grade_level", { ascending: true })
    .order("class_name", { ascending: true });

  if (error) return jsonError(error.message);
  return NextResponse.json({ classes: data ?? [] });
}

