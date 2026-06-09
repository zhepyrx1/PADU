"use client";

import { CalendarDays, Clipboard, KeyRound, Plus, RefreshCw, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";

type Exam = {
  id: string;
  title: string;
  grade_level?: number | null;
  duration_minutes: number;
  total_questions: number;
  is_active: boolean;
  start_time?: string;
  end_time?: string;
  subjects?: { subject_name?: string; subject_code?: string } | null;
};

type Token = {
  token: string;
  token_type: "exam" | "unlock";
  created_at?: string;
  expires_at?: string | null;
};

type Row = {
  id: string;
  status: string;
  final_score: number | null;
  student_answers?: { id: string }[];
  students?: {
    nis?: string;
    room_name?: string;
    profiles?: { full_name?: string };
    classes?: { class_name?: string };
  };
};

type ClassItem = {
  id: string;
  class_name: string;
  grade_level?: number | null;
  major?: string | null;
};

function todayValue() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function timeValue(date = new Date()) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function timeLabel(dateText: string | undefined) {
  if (!dateText) return "--.--";
  return new Date(dateText).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replaceAll(":", ".");
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function localTimestamp(date: Date) {
  return `${todayValue()}T${timeValue(date)}:00`;
}

function sameDate(dateText: string | undefined, selectedDate: string) {
  if (!dateText) return false;
  return dateText.slice(0, 10) === selectedDate;
}

function scheduleDate(dateText: string | undefined) {
  return dateText?.slice(0, 10) ?? "";
}

function dateLabel(dateText: string | undefined) {
  if (!dateText) return "-";
  return new Date(`${dateText.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function localDateTimeKey(value?: string) {
  return value?.replace(" ", "T").slice(0, 19) ?? "";
}

function nowKey() {
  const now = new Date();
  const date = todayValue();
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return `${date}T${time}`;
}

function keyToMs(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function keyFromMs(ms: number) {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
}

function tokenReloadOpen(exam: Exam) {
  const start = localDateTimeKey(exam.start_time);
  if (!start) return false;
  const deadline = tokenWindowEndKey(exam);
  const now = nowKey();
  return now >= start && now <= deadline;
}

function tokenWindowEndKey(exam: Exam) {
  const start = localDateTimeKey(exam.start_time);
  return start ? keyFromMs(keyToMs(start) + 5 * 60 * 1000) : "";
}

function timeRange(exam: Exam) {
  const start = timeLabel(exam.start_time);
  const end = timeLabel(exam.end_time);
  return `${start} - ${end}`;
}

function scheduleLabel(exam: Exam) {
  return `${dateLabel(exam.start_time)} - ${timeRange(exam)} - ${exam.duration_minutes} menit`;
}

function isExamActiveNow(exam: Exam) {
  if (!exam.is_active) return false;
  const now = nowKey();
  const start = localDateTimeKey(exam.start_time);
  const end = localDateTimeKey(exam.end_time);
  return (!start || now >= start) && (!end || now <= end);
}

function statusLabel(status: string) {
  return {
    not_started: "Belum mulai",
    in_progress: "Sedang asesmen",
    locked: "Terkunci",
    finished: "Selesai"
  }[status] ?? status;
}

function classRank(className = "") {
  const clean = className.toUpperCase().replace(/\s+/g, "").replace("IS", "S");
  const ten = clean.match(/^X?-?10-?(\d{1,2})$/) ?? clean.match(/^10-?(\d{1,2})$/);
  if (ten) return Number(ten[1]);
  const elevenA = clean.match(/^XI-?A(\d)$/);
  if (elevenA) return 100 + Number(elevenA[1]);
  const elevenS = clean.match(/^XI-?S(\d)$/);
  if (elevenS) return 200 + Number(elevenS[1]);
  return 9999;
}

function isAllowedClass(item: ClassItem, gradeLevel: 10 | 11 | 12) {
  const clean = item.class_name.toUpperCase().replace(/\s+/g, "").replace("IS", "S");
  if (gradeLevel === 10) return /^X?-?10-?(10|[1-9])$/.test(clean) || /^10-?(10|[1-9])$/.test(clean);
  if (gradeLevel === 11) return /^XI-?A[1-6]$/.test(clean) || /^XI-?S[1-4]$/.test(clean);
  return (item.grade_level ?? gradeLevel) === gradeLevel;
}

function TokenBox({
  title,
  token,
  tone,
  onReload
}: {
  title: string;
  token?: Token;
  tone: "navy" | "green";
  onReload: () => void;
}) {
  const color = tone === "green" ? "bg-green-600" : "bg-navy-900";

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
          <KeyRound size={20} />
          {title}
        </h2>
        <button onClick={onReload} className={`inline-flex items-center gap-2 rounded-md ${color} px-3 py-2 text-sm font-semibold text-white`}>
          <RotateCw size={16} />
          Reload
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="rounded-md bg-slate-100 px-5 py-3 text-3xl font-bold tracking-[0.18em] text-navy-900">
          {token?.token ?? "------"}
        </div>
        <button
          onClick={() => token?.token && navigator.clipboard.writeText(token.token)}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          disabled={!token?.token}
        >
          <Clipboard size={16} />
          Salin
        </button>
      </div>
    </div>
  );
}

export function ProctorConsole() {
  const [activeSection, setActiveSection] = useState("asesmen");
  const [examMode, setExamMode] = useState<"asesmen" | "tka">("asesmen");
  const [selectedDate, setSelectedDate] = useState(todayValue());
  const [gradeLevel, setGradeLevel] = useState<10 | 11 | 12>(11);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tokens, setTokens] = useState<Token[]>([]);
  const [allTokens, setAllTokens] = useState<Record<string, Token[]>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [manualSubject, setManualSubject] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualMode, setManualMode] = useState<"asesmen" | "tka">("asesmen");
  const [manualDuration, setManualDuration] = useState(90);
  const [manualStartTime, setManualStartTime] = useState(() => timeValue());
  const [manualEndTime, setManualEndTime] = useState(() => timeValue(addMinutes(new Date(), 90)));
  const [manualTotalQuestions, setManualTotalQuestions] = useState(20);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  function matchesMode(exam: Exam) {
    const title = `${exam.title ?? ""} ${exam.subjects?.subject_name ?? ""}`.toLowerCase();
    const isTka = title.includes("tka") || title.includes("tes kemampuan akademik");
    return examMode === "tka" ? isTka : !isTka;
  }
  const dayExams = useMemo(
    () => exams.filter((exam) => sameDate(exam.start_time, selectedDate) && (exam.grade_level ?? 11) === gradeLevel && matchesMode(exam)),
    [exams, selectedDate, gradeLevel, examMode]
  );
  const gradeExams = useMemo(() => exams.filter((exam) => (exam.grade_level ?? 11) === gradeLevel && matchesMode(exam)), [exams, gradeLevel, examMode]);
  const dayFolders = useMemo(() => {
    const dates = new Map<string, number>();
    gradeExams.forEach((exam) => {
      const date = scheduleDate(exam.start_time);
      if (date) dates.set(date, (dates.get(date) ?? 0) + 1);
    });
    return [...dates.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [gradeExams]);
  const selectedExam = exams.find((exam) => exam.id === examId);
  const tokenExams = useMemo(() => dayExams.length > 0 ? dayExams : selectedExam ? [selectedExam] : [], [dayExams, selectedExam]);
  const examToken = tokens.find((token) => token.token_type === "exam");
  const unlockToken = tokens.find((token) => token.token_type === "unlock");
  const locked = useMemo(() => rows.filter((row) => row.status === "locked"), [rows]);
  const finished = useMemo(() => rows.filter((row) => row.status === "finished"), [rows]);
  const gradeClasses = useMemo(
    () => classes
      .filter((item) => (item.grade_level ?? gradeLevel) === gradeLevel && isAllowedClass(item, gradeLevel))
      .sort((a, b) => classRank(a.class_name) - classRank(b.class_name) || a.class_name.localeCompare(b.class_name)),
    [classes, gradeLevel]
  );
  const groupedRows = useMemo(() => {
    const groups = new Map<string, Row[]>();
    rows.forEach((row) => {
      const className = row.students?.classes?.class_name ?? row.students?.room_name ?? "Tanpa Kelas";
      groups.set(className, [...(groups.get(className) ?? []), row]);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => classRank(a) - classRank(b) || a.localeCompare(b))
      .map(([className, items]) => [
        className,
        items.sort((a, b) => (a.students?.profiles?.full_name ?? a.students?.nis ?? "").localeCompare(b.students?.profiles?.full_name ?? b.students?.nis ?? ""))
      ] as const);
  }, [rows]);

  function sectionClass(id: string, className: string) {
    return activeSection === id ? className : `${className} hidden`;
  }

  function tokenFor(targetExamId: string, tokenType: "exam" | "unlock") {
    return allTokens[targetExamId]?.find((token) => token.token_type === tokenType);
  }

  async function loadExams() {
    const response = await fetch("/api/exams", { credentials: "include" });
    const data = await response.json();
    setExams(data.exams ?? []);
  }

  async function loadClasses() {
    const response = await fetch("/api/classes", { credentials: "include" });
    const data = await response.json();
    setClasses(data.classes ?? []);
  }

  async function loadTokens(targetExamId = examId) {
    if (!targetExamId) {
      setTokens([]);
      return;
    }
    const response = await fetch(`/api/tokens?examId=${targetExamId}`, { credentials: "include" });
    const data = await response.json();
    setTokens(data.tokens ?? []);
  }

  async function loadAllTokens(items = dayExams) {
    const entries = await Promise.all(
      items.map(async (exam) => {
        const response = await fetch(`/api/tokens?examId=${exam.id}`, { credentials: "include" });
        const data = await response.json();
        return [exam.id, data.tokens ?? []] as const;
      })
    );
    setAllTokens(Object.fromEntries(entries));
  }

  async function loadMonitoring(targetExamId = examId) {
    if (!targetExamId) {
      setRows([]);
      setCounts({});
      return;
    }
    setLoading(true);
    const response = await fetch(`/api/proctor/monitoring?examId=${targetExamId}`, { credentials: "include" });
    const data = await response.json();
    setRows(data.rows ?? []);
    setCounts(data.counts ?? {});
    setLoading(false);
  }

  async function refreshAll(targetExamId = examId) {
    await Promise.all([loadTokens(targetExamId), loadMonitoring(targetExamId), loadExams(), loadAllTokens()]);
  }

  async function createToken(tokenType: "exam" | "unlock", targetExamId = examId) {
    if (!targetExamId) {
      setMessage("Pilih mapel/asesmen dulu.");
      return;
    }
    const targetExam = exams.find((exam) => exam.id === targetExamId);
    if (tokenType === "exam" && targetExam && !tokenReloadOpen(targetExam)) {
      setMessage("Token masuk hanya bisa direload pada 5 menit pertama setelah mapel diaktifkan.");
      return;
    }
    const expiresAt = tokenType === "exam" && targetExam && isExamActiveNow(targetExam)
      ? tokenWindowEndKey(targetExam)
      : null;
    setMessage("Membuat token baru...");
    const response = await fetch("/api/tokens", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId: targetExamId, tokenType, expiresAt })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Token gagal dibuat.");
      return;
    }
    setMessage(
      tokenType === "exam" && expiresAt
        ? `Token asesmen diperbarui dan berlaku sampai ${timeLabel(expiresAt)}.`
        : `Token ${tokenType === "exam" ? "asesmen" : "unlock"} untuk mapel ini berhasil diperbarui.`
    );
    await Promise.all([loadTokens(targetExamId), loadMonitoring(targetExamId), loadAllTokens()]);
  }

  async function createManualExam() {
    const baseTitle = manualTitle.trim() || `${manualSubject.trim()} Kelas ${gradeLevel}`;
    const title = manualMode === "tka" && !baseTitle.toLowerCase().includes("tka") ? `TKA - ${baseTitle}` : baseTitle;
    if (!manualSubject.trim()) {
      setMessage("Nama mapel wajib diisi dulu.");
      return;
    }
    if (selectedClassIds.length === 0) {
      setMessage("Centang minimal 1 kelas/rombel yang dapat mapel ini.");
      return;
    }
    const now = new Date();
    let startTime = manualStartTime;
    let endTime = manualEndTime;
    if (selectedDate === todayValue() && `${selectedDate}T${endTime}:00` <= `${selectedDate}T${timeValue(now)}:00`) {
      startTime = timeValue(now);
      endTime = timeValue(addMinutes(now, manualDuration));
      setManualStartTime(startTime);
      setManualEndTime(endTime);
    }

    setMessage(`Membuat ${manualMode === "tka" ? "simulasi TKA" : "asesmen"} dan mendaftarkan siswa...`);
    const response = await fetch("/api/exams", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectName: manualSubject,
        title,
        gradeLevel,
        startTime: `${selectedDate}T${startTime}:00`,
        endTime: `${selectedDate}T${endTime}:00`,
        durationMinutes: manualDuration,
        totalQuestions: manualTotalQuestions,
        classIds: selectedClassIds
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Gagal membuat asesmen.");
      return;
    }
    setMessage(`${manualMode === "tka" ? "Simulasi TKA" : "Asesmen"} berhasil dibuat. ${data.participantCount ?? 0} siswa kelas ${gradeLevel} otomatis didaftarkan.`);
    setManualSubject("");
    setManualTitle("");
    setSelectedClassIds([]);
    await loadExams();
    if (data.exam?.id) setExamId(data.exam.id);
  }

  async function activateExamNow(exam: Exam) {
    const now = new Date();
    const duration = exam.duration_minutes || manualDuration || 90;
    const startTime = timeValue(now);
    const endTime = timeValue(addMinutes(now, duration));
    const tokenExpiresAt = localTimestamp(addMinutes(now, 5));
    setMessage("Mengaktifkan jadwal mapel sekarang...");
    const response = await fetch("/api/exams", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examId: exam.id,
        startTime: `${todayValue()}T${startTime}:00`,
        endTime: `${todayValue()}T${endTime}:00`,
        durationMinutes: duration
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Gagal mengaktifkan mapel.");
      return;
    }
    const existingExamToken = tokenFor(exam.id, "exam");
    const tokenAlreadyCreatedForThisActivation = existingExamToken?.expires_at
      ? localDateTimeKey(existingExamToken.expires_at) >= `${todayValue()}T${startTime}:00`
      : false;
    if (!tokenAlreadyCreatedForThisActivation) {
      const tokenResponse = await fetch("/api/tokens", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: exam.id,
          tokenType: "exam",
          expiresAt: tokenExpiresAt
        })
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        setMessage(tokenData.error ?? "Mapel aktif, tapi token masuk gagal dibuat.");
        await loadExams();
        return;
      }
    }
    setSelectedDate(todayValue());
    setExamId(exam.id);
    setMessage(`${exam.subjects?.subject_name ?? "Mapel"} aktif sampai ${endTime}. Token masuk berlaku 5 menit pertama; reload token hanya dibuka sampai ${timeLabel(tokenExpiresAt)}.`);
    await Promise.all([loadExams(), loadTokens(exam.id), loadAllTokens(dayExams)]);
  }

  async function deleteExam(exam: Exam) {
    if (!window.confirm(`Hapus mapel/asesmen "${exam.title}"? Semua token, peserta, dan soal terkait ikut terhapus.`)) return;
    setMessage("Menghapus mapel/asesmen...");
    const response = await fetch(`/api/exams?examId=${exam.id}`, { method: "DELETE", credentials: "include" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Gagal menghapus mapel/asesmen.");
      return;
    }
    setMessage("Mapel/asesmen berhasil dihapus.");
    if (exam.id === examId) setExamId("");
    await loadExams();
  }

  async function repeatParticipant(row: Row) {
    const name = row.students?.profiles?.full_name ?? row.students?.nis ?? "siswa ini";
    if (!window.confirm(`Ulangi asesmen untuk ${name}? Jawaban dan nilai sebelumnya akan dihapus.`)) return;
    setMessage("Mengatur siswa agar bisa mengulang...");
    const response = await fetch("/api/proctor/monitoring", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: row.id, action: "repeat" })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Gagal mengulang asesmen siswa.");
      return;
    }
    if (selectedExam?.start_time) setSelectedDate(scheduleDate(selectedExam.start_time));
    if (selectedExam?.grade_level) setGradeLevel(selectedExam.grade_level as 10 | 11 | 12);
    setMessage(`${name} bisa mengulang asesmen. Minta siswa refresh dashboard lalu masukkan token lagi.`);
    await Promise.all([loadMonitoring(), loadAllTokens(tokenExams)]);
  }

  useEffect(() => {
    void loadExams();
    void loadClasses();
    const timer = window.setInterval(() => void loadExams(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.replace("#", "");
      const aliases: Record<string, string> = {
        "hari-asesmen": "asesmen",
        "buat-asesmen": "daftar-mapel",
        "token-mapel": "asesmen"
      };
      if (hash) setActiveSection(aliases[hash] ?? hash);
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    const first = dayExams[0]?.id ?? "";
    setExamId((current) => dayExams.some((exam) => exam.id === current) ? current : first);
  }, [dayExams]);

  useEffect(() => {
    setSelectedClassIds([]);
  }, [gradeLevel]);

  useEffect(() => {
    if (selectedDate !== todayValue()) return;
    const now = new Date();
    setManualStartTime(timeValue(now));
    setManualEndTime(timeValue(addMinutes(now, manualDuration)));
  }, [selectedDate, manualDuration]);

  useEffect(() => {
    void loadAllTokens(tokenExams);
  }, [tokenExams]);

  useEffect(() => {
    void refreshAll(examId);
    const timer = window.setInterval(() => loadMonitoring(examId), 8000);
    return () => window.clearInterval(timer);
  }, [examId]);

  return (
    <div className="grid gap-6">
      <section id="asesmen" className={sectionClass("asesmen", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
              <CalendarDays size={20} />
              Asesmen
            </h2>
            <p className="mt-1 text-sm text-slate-600">Pilih hari, kelas, dan mapel yang sedang diujiankan. Token ringkas tampil per mapel.</p>
          </div>
          <button onClick={() => refreshAll()} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm">
            <RefreshCw size={16} />
            Refresh Data
          </button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <button onClick={() => setExamMode("asesmen")} className={`rounded-md border px-4 py-3 text-left font-semibold ${examMode === "asesmen" ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}>
            Asesmen
            <span className="mt-1 block text-xs font-medium opacity-80">Kelola ujian mapel sekolah.</span>
          </button>
          <button onClick={() => setExamMode("tka")} className={`rounded-md border px-4 py-3 text-left font-semibold ${examMode === "tka" ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}>
            Simulasi TKA
            <span className="mt-1 block text-xs font-medium opacity-80">Kelola paket simulasi TKA.</span>
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
          <label className="text-sm font-medium">
            Tanggal
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <div>
            <div className="text-sm font-medium">Kelas</div>
            <div className="mt-1 grid gap-2 md:grid-cols-3">
              {[10, 11, 12].map((grade) => (
                <button
                  key={grade}
                  onClick={() => setGradeLevel(grade as 10 | 11 | 12)}
                  className={`rounded-md border px-4 py-2 text-left font-semibold ${gradeLevel === grade ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}
                >
                  Kelas {grade}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-md border bg-slate-50 p-4">
          <div className="font-semibold text-navy-900">Folder Mapel per Hari</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {dayFolders.map(([date, count]) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${selectedDate === date ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}
              >
                {dateLabel(date)} ({count} mapel)
              </button>
            ))}
            {dayFolders.length === 0 ? <p className="text-sm text-slate-500">Belum ada folder mapel untuk kelas ini.</p> : null}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dayExams.map((exam) => {
            const examTokenForCard = tokenFor(exam.id, "exam");
            const unlockTokenForCard = tokenFor(exam.id, "unlock");
            const activeNow = isExamActiveNow(exam);
            return (
              <div
                key={exam.id}
                onClick={() => setExamId(exam.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setExamId(exam.id);
                }}
                className={`cursor-pointer rounded-lg border p-4 text-left hover:border-navy-700 ${exam.id === examId ? "border-navy-900 bg-navy-50" : activeNow ? "bg-white" : "bg-slate-50 opacity-80"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-green-700">{exam.subjects?.subject_name ?? "Mapel"}</div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${activeNow ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                    {activeNow ? "Aktif" : "Belum Aktif"}
                  </span>
                </div>
                <div className="mt-1 text-lg font-bold text-navy-900">{exam.title}</div>
                <div className="mt-1 text-sm text-slate-600">{scheduleLabel(exam)}</div>
                {activeNow ? (
                  <div className="mt-3 inline-flex rounded-md bg-green-600 px-3 py-2 text-xs font-bold text-white">Aktif</div>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void activateExamNow(exam);
                    }}
                    className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700"
                  >
                    Aktifkan Sekarang
                  </button>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-slate-100 px-2 py-2">
                    <div className="text-slate-500">Token Asesmen</div>
                    <div className="mt-1 font-bold tracking-[0.18em] text-navy-900">{examTokenForCard?.token ?? "------"}</div>
                  </div>
                  <div className="rounded-md bg-green-50 px-2 py-2">
                    <div className="text-slate-500">Token Unlock</div>
                    <div className="mt-1 font-bold tracking-[0.18em] text-green-700">{unlockTokenForCard?.token ?? "------"}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {dayExams.length === 0 ? <p className="text-sm text-slate-500">Belum ada {examMode === "tka" ? "simulasi TKA" : "asesmen"} untuk tanggal dan kelas ini.</p> : null}
        </div>
      </section>

      <section id="daftar-mapel" className={sectionClass("daftar-mapel", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <h2 className="text-lg font-semibold text-navy-900">Daftar {examMode === "tka" ? "Simulasi TKA" : "Mapel Asesmen"} Kelas {gradeLevel}</h2>
        <p className="mt-1 text-sm text-slate-600">{examMode === "tka" ? "Paket simulasi TKA" : "Mapel/asesmen"} kelas {gradeLevel} yang sudah dibuat dan bisa dijadwalkan untuk siswa.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {gradeExams.map((exam) => (
            <div key={exam.id} className="rounded-lg border bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-green-700">{exam.subjects?.subject_name ?? "Mapel"}</div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${isExamActiveNow(exam) ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                  {isExamActiveNow(exam) ? "Aktif" : "Belum Aktif"}
                </span>
              </div>
              <div className="mt-1 font-bold text-navy-900">{exam.title}</div>
              <div className="mt-2 text-sm text-slate-600">{scheduleLabel(exam)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {isExamActiveNow(exam) ? (
                  <span className="rounded-md bg-green-600 px-3 py-2 text-sm font-bold text-white">Aktif</span>
                ) : (
                  <button onClick={() => activateExamNow(exam)} className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                    Aktifkan Sekarang
                  </button>
                )}
                <button onClick={() => deleteExam(exam)} className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">
                  <Trash2 size={16} />
                  Hapus Mapel
                </button>
              </div>
            </div>
          ))}
          {gradeExams.length === 0 ? <p className="text-sm text-slate-500">Belum ada {examMode === "tka" ? "simulasi TKA" : "mapel/asesmen"} untuk kelas {gradeLevel}.</p> : null}
        </div>
        <div className="mt-6 border-t pt-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
          <Plus size={20} />
          Buat Paket Manual
        </h2>
        <p className="mt-1 text-sm text-slate-600">Dipakai kalau belum ada asesmen atau simulasi TKA untuk kelas dan hari ini. Siswa kelas terpilih otomatis masuk daftar peserta.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setManualMode("asesmen")}
            className={`rounded-md border px-4 py-3 text-left font-semibold ${manualMode === "asesmen" ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}
          >
            Asesmen
            <span className="mt-1 block text-xs font-medium opacity-80">Untuk ujian mapel sekolah.</span>
          </button>
          <button
            type="button"
            onClick={() => setManualMode("tka")}
            className={`rounded-md border px-4 py-3 text-left font-semibold ${manualMode === "tka" ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}
          >
            Simulasi TKA
            <span className="mt-1 block text-xs font-medium opacity-80">Tampil di mode TKA siswa, 1 soal 1 menit.</span>
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_1fr]">
          <label className="text-sm font-medium">
            Tanggal / Hari
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
            <span className="mt-1 block text-xs font-semibold text-green-700">{dateLabel(selectedDate)}</span>
          </label>
          <label className="text-sm font-medium">
            Mapel
            <input value={manualSubject} onChange={(event) => setManualSubject(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Contoh: Fisika" />
          </label>
          <label className="text-sm font-medium">
            Judul Asesmen
            <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" placeholder={manualMode === "tka" ? `Contoh: Numerasi Kelas ${gradeLevel}` : `Contoh: Penilaian Harian Kelas ${gradeLevel}`} />
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="text-sm font-medium">
            Mulai
            <input type="time" value={manualStartTime} onChange={(event) => setManualStartTime(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="text-sm font-medium">
            Selesai
            <input type="time" value={manualEndTime} onChange={(event) => setManualEndTime(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="text-sm font-medium">
            Durasi Menit
            <input type="number" value={manualDuration} onChange={(event) => setManualDuration(Number(event.target.value))} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="text-sm font-medium">
            Jumlah Soal
            <input type="number" value={manualTotalQuestions} onChange={(event) => setManualTotalQuestions(Number(event.target.value))} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
        </div>
        <div className="mt-4">
          <div className="text-sm font-medium">Kelas/Rombel yang Mendapat Mapel Ini</div>
          <div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-4">
            {gradeClasses.map((item) => {
              const checked = selectedClassIds.includes(item.id);
              return (
                <label key={item.id} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${checked ? "border-navy-900 bg-blue-50" : "bg-white"}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setSelectedClassIds((prev) => event.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id));
                    }}
                  />
                  <span className="font-semibold">{item.class_name}</span>
                </label>
              );
            })}
          </div>
          {gradeClasses.length === 0 ? <p className="mt-2 text-sm text-amber-700">Belum ada data kelas untuk tingkat {gradeLevel}.</p> : null}
        </div>
        <button onClick={createManualExam} className="mt-4 inline-flex items-center gap-2 rounded-md bg-navy-900 px-4 py-2 font-semibold text-white">
          <Plus size={18} />
          Buat {manualMode === "tka" ? "Simulasi TKA" : "Asesmen"} Kelas {gradeLevel}
        </button>
        </div>
      </section>

      <section id="token-mapel" className="hidden">
        <h2 className="text-lg font-semibold text-navy-900">Token Mapel Per Kelas</h2>
        <p className="mt-1 text-sm text-slate-600">Pilih mapel yang sedang dikerjakan. Token berlaku hanya untuk mapel dan kelas ini.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dayExams.map((exam) => (
            <button
              key={exam.id}
              onClick={() => setExamId(exam.id)}
              className={`rounded-lg border p-4 text-left hover:border-navy-700 ${exam.id === examId ? "border-navy-900 bg-navy-50" : "bg-white"}`}
            >
              <div className="text-sm font-semibold text-green-700">Kelas {exam.grade_level ?? gradeLevel} - {exam.subjects?.subject_name ?? "Mapel"}</div>
              <div className="mt-1 text-lg font-bold text-navy-900">{exam.title}</div>
              <div className="mt-2 text-sm text-slate-600">{exam.duration_minutes} menit - {exam.total_questions} soal</div>
            </button>
          ))}
          {dayExams.length === 0 ? <p className="text-sm text-slate-500">Belum ada asesmen untuk tanggal dan kelas ini.</p> : null}
        </div>
      </section>

      {selectedExam && ["asesmen", "token-asesmen", "monitoring-peserta"].includes(activeSection) ? (
        <section className="rounded-lg bg-navy-900 p-5 text-white shadow-sm">
          <div className="text-sm text-blue-100">Sedang Dipantau</div>
          <h2 className="mt-1 text-2xl font-bold">{selectedExam.subjects?.subject_name ?? "Mapel"} - Kelas {selectedExam.grade_level ?? gradeLevel}</h2>
          <p className="mt-1 text-blue-100">{selectedExam.title}</p>
        </section>
      ) : null}

      <section id="token-asesmen" className={sectionClass("token-asesmen", "scroll-mt-6 grid gap-4")}>
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-navy-900">Token Asesmen Semua Mapel</h2>
          <p className="mt-1 text-sm text-slate-600">Hanya mapel yang tanggal jadwalnya sama dengan tanggal terpilih yang ditampilkan.</p>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {tokenExams.map((exam) => (
              <div key={exam.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-green-700">{exam.subjects?.subject_name ?? "Mapel"}</div>
                    <div className="mt-1 font-bold text-navy-900">{exam.title}</div>
                    <div className="mt-1 text-sm text-slate-600">{scheduleLabel(exam)}</div>
                  </div>
                  <button onClick={() => setExamId(exam.id)} className="rounded-md border px-3 py-2 text-sm">Pilih Monitoring</button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <TokenBox title="Token Asesmen" token={tokenFor(exam.id, "exam")} tone="navy" onReload={() => createToken("exam", exam.id)} />
                  <TokenBox title="Token Unlock" token={tokenFor(exam.id, "unlock")} tone="green" onReload={() => createToken("unlock", exam.id)} />
                </div>
              </div>
            ))}
            {tokenExams.length === 0 ? <p className="text-sm text-slate-500">Belum ada mapel pada tanggal dan kelas ini.</p> : null}
          </div>
        </div>
      </section>

      {message ? <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}

      <section id="monitoring-peserta" className={sectionClass("monitoring-peserta", "scroll-mt-6")}>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-navy-900">Monitoring Peserta</h2>
          <p className="text-sm text-slate-600">{selectedExam ? `${selectedExam.subjects?.subject_name ?? "Mapel"} - ${selectedExam.title}` : "Pilih mapel dahulu."}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Belum Mulai" value={counts.not_started ?? 0} tone="slate" />
          <StatCard label="Mengerjakan" value={counts.in_progress ?? 0} />
          <StatCard label="Terkunci" value={counts.locked ?? 0} tone="gold" />
          <StatCard label="Selesai" value={counts.finished ?? 0} tone="green" />
        </div>
      </section>

      <section id="siswa-terkunci" className={sectionClass("siswa-terkunci", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <h2 className="text-lg font-semibold text-navy-900">Siswa Terkunci</h2>
        <div className="mt-3 grid gap-2">
          {locked.length === 0 ? <p className="text-sm text-slate-500">Tidak ada siswa terkunci.</p> : null}
          {locked.map((row) => (
            <div key={row.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              {row.students?.profiles?.full_name ?? row.students?.nis} - {row.students?.classes?.class_name ?? "-"}
            </div>
          ))}
        </div>
      </section>

      <section id="siswa-selesai" className={sectionClass("siswa-selesai", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <h2 className="text-lg font-semibold text-navy-900">Siswa Selesai</h2>
        <div className="mt-3 grid gap-2">
          {finished.length === 0 ? <p className="text-sm text-slate-500">Belum ada siswa selesai.</p> : null}
          {finished.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
              <span>{row.students?.profiles?.full_name ?? row.students?.nis} - nilai {row.final_score ?? "-"}</span>
              <button onClick={() => repeatParticipant(row)} className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-navy-900">
                Ulangi
              </button>
            </div>
          ))}
        </div>
      </section>

      <section id="jawaban-per-siswa" className={sectionClass("jawaban-per-siswa", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <h2 className="text-lg font-semibold text-navy-900">Jawaban / Progress Per Siswa</h2>
        <p className="mt-1 text-sm text-slate-600">Pilih mapel pada tanggal ini, lalu progress otomatis dikelompokkan per kelas.</p>
        <div className="mt-4 rounded-md border bg-slate-50 p-4">
          <div className="text-sm font-semibold text-navy-900">Folder Mapel - {dateLabel(selectedDate)}</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {dayExams.map((exam) => (
              <button
                key={exam.id}
                onClick={() => setExamId(exam.id)}
                className={`rounded-md border px-3 py-2 text-left text-sm ${exam.id === examId ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}
              >
                <span className="block font-bold">{exam.subjects?.subject_name ?? "Mapel"}</span>
                <span className={exam.id === examId ? "text-blue-100" : "text-slate-600"}>{timeRange(exam)} - {exam.total_questions} soal</span>
              </button>
            ))}
            {dayExams.length === 0 ? <p className="text-sm text-slate-500">Belum ada mapel pada tanggal dan kelas ini.</p> : null}
          </div>
        </div>
        {loading ? <p className="mt-3 text-sm text-slate-500">Memuat data...</p> : null}
        <div className="mt-4 grid gap-4">
          {groupedRows.length === 0 && !loading ? <p className="text-sm text-slate-500">Belum ada peserta/progress untuk mapel ini.</p> : null}
          {groupedRows.map(([className, items]) => (
            <div key={className} className="rounded-lg border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-navy-900">{className}</h3>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{items.length} siswa</span>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4">Nama</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Progress</th>
                      <th className="py-2 pr-4">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{row.students?.profiles?.full_name ?? row.students?.nis}</td>
                        <td className="py-2 pr-4">{statusLabel(row.status)}</td>
                        <td className="py-2 pr-4">{row.student_answers?.length ?? 0} jawaban</td>
                        <td className="py-2 pr-4">{row.final_score ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
