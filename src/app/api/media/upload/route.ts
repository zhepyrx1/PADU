import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !["admin", "teacher"].includes(session.role)) return jsonError("Akses ditolak.", 403);

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = String(formData.get("folder") ?? "umum").replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  if (!(file instanceof File)) return jsonError("File gambar wajib diisi.");
  if (file.size > 8 * 1024 * 1024) return jsonError("Ukuran gambar maksimal 8 MB. Sistem akan mengompres gambar dari dashboard guru.");
  if (!["image/webp", "image/jpeg", "image/png"].includes(file.type)) return jsonError("Format yang didukung: WebP, JPG, atau PNG.");

  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from("question-images").upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (error) return jsonError(error.message);
  return NextResponse.json({ path });
}
