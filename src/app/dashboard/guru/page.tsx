import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getSession } from "@/lib/session";
import { QuestionBuilder } from "./question-builder";

export default async function GuruPage() {
  const session = await getSession();
  if (!session || !["teacher", "admin"].includes(session.role)) redirect("/");

  return (
    <DashboardShell
      title="PADU Guru"
      subtitle="Kelola asesmen, soal, gambar soal, kunci jawaban, dan rekap nilai."
      session={session}
      menu={[
        { label: "Mapel Saya", icon: "book", href: "#mapel-saya" },
        { label: "Input Soal", icon: "database", href: "#input-soal" },
        { label: "Bank Soal", icon: "database", href: "#bank-soal" },
        { label: "Kunci Jawaban", icon: "key", href: "#kunci-jawaban" },
        { label: "Hasil Jawaban", icon: "monitor", href: "#hasil-jawaban" },
        { label: "Rekap Nilai", icon: "monitor", href: "#rekap-nilai" }
      ]}
    >
      <QuestionBuilder />
    </DashboardShell>
  );
}
