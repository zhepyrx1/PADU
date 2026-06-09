import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { ResourcePanel } from "@/components/ResourcePanel";
import { StatCard } from "@/components/StatCard";
import { getSession } from "@/lib/session";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/");

  return (
    <DashboardShell
      title="PADU Admin"
      subtitle="Kelola data pengguna, kelas, mapel, asesmen, soal, dan hasil dalam satu portal."
      session={session}
      menu={[
        { label: "Data Siswa", icon: "users", href: "#data-siswa" },
        { label: "Data Guru", icon: "cap", href: "#data-guru" },
        { label: "Data Proktor", icon: "monitor", href: "#data-proktor" },
        { label: "Data Kelas", icon: "database", href: "#data-kelas" },
        { label: "Data Mapel", icon: "book", href: "#data-mapel" },
        { label: "Data Asesmen", icon: "book", href: "#data-asesmen" },
        { label: "Bank Soal", icon: "database", href: "#bank-soal" },
        { label: "Hasil Asesmen", icon: "monitor", href: "#hasil-asesmen" }
      ]}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Target Siswa" value="1000" />
        <StatCard label="Mode Login" value="Custom" tone="green" />
        <StatCard label="Polling Proktor" value="5-10s" tone="gold" />
        <StatCard label="Storage" value="Supabase" tone="slate" />
      </div>
      <div className="mt-6 grid gap-6">
        <ResourcePanel
          id="data-siswa"
          resource="students"
          title="Data Siswa"
          fields={[
            { name: "profile_id", label: "Profile ID" },
            { name: "class_id", label: "Class ID" },
            { name: "room_name", label: "Ruang", placeholder: "Lab 1" }
          ]}
        />
        <ResourcePanel
          id="data-guru"
          resource="profiles"
          title="Data Guru / Proktor / Admin"
          fields={[
            { name: "username", label: "Username" },
            { name: "full_name", label: "Nama Lengkap" },
            { name: "role", label: "Role", placeholder: "teacher / proctor / admin" },
            { name: "is_active", label: "Aktif", placeholder: "true" }
          ]}
        />
        <section id="data-proktor" className="scroll-mt-6 rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-navy-900">Data Proktor</h2>
          <p className="mt-1 text-sm text-slate-600">Kelola proktor melalui panel Data Guru / Proktor / Admin dengan role <code>proctor</code>.</p>
        </section>
        <ResourcePanel
          id="data-kelas"
          resource="classes"
          title="CRUD Kelas"
          fields={[
            { name: "class_name", label: "Nama Kelas", placeholder: "XI MIPA 6" },
            { name: "grade_level", label: "Tingkat", type: "number" },
            { name: "major", label: "Jurusan", placeholder: "MIPA" }
          ]}
        />
        <ResourcePanel
          id="data-mapel"
          resource="subjects"
          title="CRUD Mapel"
          fields={[
            { name: "subject_name", label: "Nama Mapel", placeholder: "Fisika" },
            { name: "subject_code", label: "Kode Mapel", placeholder: "FIS" }
          ]}
        />
        <ResourcePanel
          id="data-asesmen"
          resource="exams"
          title="CRUD Asesmen"
          fields={[
            { name: "subject_id", label: "Subject ID" },
            { name: "grade_level", label: "Kelas", type: "number", placeholder: "10 / 11 / 12" },
            { name: "title", label: "Judul Asesmen" },
            { name: "description", label: "Deskripsi" },
            { name: "start_time", label: "Mulai", type: "datetime-local" },
            { name: "end_time", label: "Selesai", type: "datetime-local" },
            { name: "duration_minutes", label: "Durasi Menit", type: "number" }
          ]}
        />
        <section id="bank-soal" className="scroll-mt-6 rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-navy-900">Bank Soal</h2>
          <p className="mt-1 text-sm text-slate-600">Input soal lengkap tersedia di dashboard Guru.</p>
        </section>
        <section id="hasil-asesmen" className="scroll-mt-6 rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-navy-900">Hasil Asesmen</h2>
          <p className="mt-1 text-sm text-slate-600">Monitoring dan hasil peserta tersedia di dashboard Proktor.</p>
        </section>
      </div>
    </DashboardShell>
  );
}
