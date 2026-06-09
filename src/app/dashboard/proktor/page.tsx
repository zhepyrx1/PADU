import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getSession } from "@/lib/session";
import { ProctorConsole } from "./proctor-console";

export default async function ProktorPage() {
  const session = await getSession();
  if (!session || !["proctor", "admin"].includes(session.role)) redirect("/");

  return (
    <DashboardShell
      title="PADU Proktor"
      subtitle="Monitoring asesmen digital SMAN 2 Cikarang Selatan."
      session={session}
      menu={[
        { label: "Asesmen", icon: "book", href: "#asesmen" },
        { label: "Daftar Mapel", icon: "database", href: "#daftar-mapel" },
        { label: "Token Asesmen", icon: "key", href: "#token-asesmen" },
        { label: "Monitoring Peserta", icon: "monitor", href: "#monitoring-peserta" },
        { label: "Siswa Terkunci", icon: "users", href: "#siswa-terkunci" },
        { label: "Siswa Selesai", icon: "users", href: "#siswa-selesai" },
        { label: "Progress Siswa", icon: "database", href: "#jawaban-per-siswa" }
      ]}
    >
      <ProctorConsole />
    </DashboardShell>
  );
}
