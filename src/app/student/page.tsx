"use client";

import { ArrowLeft, BookOpen, CalendarDays, Check, CheckCircle, Clock, Eye, EyeOff, Grid3X3, Info, KeyRound, Lock, LogIn, LogOut, Puzzle, RefreshCw, RotateCw, ShieldCheck, UserRound, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Student = {
  fullName: string;
  className?: string | null;
  roomName?: string | null;
};

type ExamItem = {
  id: string;
  status: string;
  remaining_seconds?: number | null;
  final_score?: number | null;
  result?: FinishResult | null;
  exams: {
    id: string;
    title: string;
    duration_minutes: number;
    total_questions: number;
    start_time?: string;
    end_time?: string;
    subjects?: { subject_name?: string } | null;
  };
};

type Option = { option_label: string; option_text: string; order_number: number };
type MatchingChoice = { id: string; text: string };
type StudentAnswer = { option?: string; text?: string; pairs?: Record<string, string> };
type Question = {
  id: string;
  question_text: string;
  question_type: string;
  order_number?: number | null;
  media_type?: string | null;
  media_url?: string | null;
  question_options?: Option[];
  matching_items?: {
    left: MatchingChoice[];
    right: MatchingChoice[];
  };
};

type FinishResult = {
  final_score?: number | null;
  correct_count?: number | null;
  wrong_count?: number | null;
  empty_count?: number | null;
};

type AppMode = "asesmen" | "tka";

const statusText: Record<string, string> = {
  not_started: "Belum Mulai",
  in_progress: "Sedang Asesmen",
  locked: "Terkunci",
  finished: "Selesai"
};

function Header() {
  return (
    <div className="px-6 pt-10 text-center text-white">
      <img src="/padu-logo.png" alt="Logo PADU" className="mx-auto h-24 w-24 object-contain drop-shadow-lg" />
      <h1 className="mt-4 text-4xl font-black tracking-wide">PADU</h1>
      <p className="text-sm font-semibold text-cyan-100">Portal Asesmen Dua Ciksel</p>
      <p className="mt-1 text-sm text-white/80">SMAN 2 Cikarang Selatan</p>
    </div>
  );
}

function BrandHeader({ compact = false, right }: { compact?: boolean; right?: React.ReactNode }) {
  return (
    <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-cyan-800 px-5 py-4 text-center text-white shadow-sm">
      <div className="mx-auto max-w-2xl">
        {right ? <div className="mb-2 flex justify-end">{right}</div> : null}
        <img src="/padu-logo.png" alt="Logo PADU" className={`mx-auto object-contain ${compact ? "h-14 w-14" : "h-24 w-24"}`} />
        <h1 className={`${compact ? "mt-2 text-xl" : "mt-3 text-3xl"} font-bold`}>PADU</h1>
        <p className="text-sm text-blue-100">Portal Asesmen Dua Ciksel</p>
        <p className="mt-1 text-sm">SMAN 2 Cikarang Selatan</p>
      </div>
    </div>
  );
}

function formatTime(seconds: number | null) {
  if (seconds === null) return "--:--";
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function fullDate(value = new Date()) {
  return value.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function jakartaDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}

function examDateText(value?: string) {
  if (!value) return fullDate();
  return fullDate(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function hasAnswer(answer?: StudentAnswer) {
  if (!answer) return false;
  if (answer.pairs) return Object.values(answer.pairs).some((value) => String(value ?? "").trim().length > 0);
  return [answer.option, answer.text].some((value) => String(value ?? "").trim().length > 0);
}

function questionNumber(question: Question | undefined, fallback: number) {
  return question?.order_number ?? fallback;
}

export default function StudentAppPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selected, setSelected] = useState<ExamItem | null>(null);
  const [token, setToken] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [mode, setMode] = useState<"mode_select" | "login" | "dashboard" | "token" | "exam" | "finished">("mode_select");
  const [appMode, setAppMode] = useState<AppMode>("asesmen");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [nowText, setNowText] = useState("");
  const [todayText, setTodayText] = useState("");
  const [todayKey, setTodayKey] = useState(jakartaDateKey());
  const [showQuestionNav, setShowQuestionNav] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [activeMatchLeft, setActiveMatchLeft] = useState<string | null>(null);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(60);
  const [expiredQuestionIndexes, setExpiredQuestionIndexes] = useState<Set<number>>(() => new Set());
  const finishingRef = useRef(false);

  const current = questions[index];
  const answeredQuestionIds = useMemo(() => new Set(Object.entries(answers).filter(([, answer]) => hasAnswer(answer)).map(([id]) => id)), [answers]);
  const answeredCount = answeredQuestionIds.size;
  const questionTotalLabel = questions.length;
  const currentQuestionLabel = questions.length > 0 ? index + 1 : 0;
  const progressPercent = questionTotalLabel > 0 ? Math.min(100, Math.round((currentQuestionLabel / questionTotalLabel) * 100)) : 0;
  const isTkaMode = appMode === "tka";
  const examTimerText = isTkaMode ? formatTime(questionSecondsLeft) : formatTime(remainingSeconds);

  function setMatchingPair(questionId: string, leftText: string, rightText: string) {
    setAnswers((prev) => {
      const currentPairs = prev[questionId]?.pairs ?? {};
      const pairs = Object.fromEntries(Object.entries(currentPairs).filter(([, value]) => value !== rightText));
      pairs[leftText] = rightText;
      return { ...prev, [questionId]: { pairs } };
    });
    setActiveMatchLeft(null);
  }

  function resetMatching(questionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { pairs: {} } }));
    setActiveMatchLeft(null);
  }

  async function chooseAppMode(nextMode: AppMode) {
    setAppMode(nextMode);
    setMessage("");
    setLoading(true);
    const response = await fetch(`/api/student/exams?mode=${nextMode}`, { cache: "no-store" });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMode("login");
      return;
    }
    setStudent(data.student);
    setExams(data.exams ?? []);
    setMode("dashboard");
  }

  async function login() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, app: "mobile" })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error ?? "Login gagal.");
      return;
    }
    setStudent(data.user);
    await loadDashboard();
  }

  async function loadDashboard() {
    const response = await fetch(`/api/student/exams?mode=${appMode}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Gagal memuat asesmen.");
      return;
    }
    setStudent(data.student);
    setExams(data.exams ?? []);
    setMode("dashboard");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setStudent(null);
    setExams([]);
    setUsername("");
    setPassword("");
    setMode("mode_select");
  }

  function updateApp() {
    setMessage("Memperbarui dashboard...");
    void loadDashboard().then(() => setMessage("Dashboard sudah diperbarui."));
  }

  async function enterToken(item: ExamItem) {
    setSelected(item);
    setToken("");
    setMessage("");
    setMode("token");
  }

  async function startExam() {
    if (!selected || !/^\d{6}$/.test(token)) {
      setMessage("Token harus 6 digit angka.");
      return;
    }
    const endpoint = selected.status === "locked" ? "/api/exam/unlock" : "/api/exam/start";
    const payload = selected.status === "locked"
      ? { examId: selected.exams.id, participantId: selected.id, token }
      : { examId: selected.exams.id, participantId: selected.id, token };

    setLoading(true);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      setLoading(false);
      setMessage(data.error ?? "Token tidak valid.");
      return;
    }
    const questionResponse = await fetch(`/api/exam/questions?examId=${selected.exams.id}`);
    const questionData = await questionResponse.json();
    setLoading(false);
    setQuestions(questionData.questions ?? []);
    setIndex(0);
    setActiveMatchLeft(null);
    setExpiredQuestionIndexes(new Set());
    setQuestionSecondsLeft(60);
    setRemainingSeconds(
      data.participant?.remaining_seconds
        ?? selected.remaining_seconds
        ?? selected.exams.duration_minutes * 60
    );
    finishingRef.current = false;
    setMode("exam");
  }

  async function refreshCurrentQuestion() {
    if (!selected) return;
    setMessage("Memuat ulang soal...");
    const currentId = current?.id;
    const questionResponse = await fetch(`/api/exam/questions?examId=${selected.exams.id}`);
    const questionData = await questionResponse.json();
    const freshQuestions: Question[] = questionData.questions ?? [];
    setQuestions(freshQuestions);
    const nextIndex = freshQuestions.findIndex((question) => question.id === currentId);
    if (nextIndex >= 0) setIndex(nextIndex);
    setMessage("Soal berhasil direfresh.");
  }

  async function saveCurrent(logEvent = false) {
    if (!selected || !current) return;
    const answer = answers[current.id];
    if (!answer) return;
    await fetch("/api/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: selected.id, questionId: current.id, answer, logEvent })
    });
  }

  async function move(next: number) {
    if (isTkaMode && expiredQuestionIndexes.has(next)) return;
    await saveCurrent();
    setIndex(next);
    setActiveMatchLeft(null);
    if (isTkaMode) setQuestionSecondsLeft(60);
  }

  async function finish(auto = false) {
    if (!selected) return;
    if (finishingRef.current) return;
    if (!auto) setShowFinishConfirm(false);
    finishingRef.current = true;
    if (auto) setMessage("Waktu habis. Jawaban otomatis dikumpulkan.");
    await saveCurrent(true);
    const response = await fetch("/api/exam/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: selected.id })
    });
    const data = await response.json();
    if (response.ok) {
      const finishedResult = data.result ?? null;
      setResult(finishedResult);
      setRemainingSeconds(0);
      setQuestions([]);
      setAnswers({});
      setIndex(0);
      setExpiredQuestionIndexes(new Set());
      setQuestionSecondsLeft(60);
      setSelected(null);
      setToken("");
      await loadDashboard();
      setMode("dashboard");
    } else {
      finishingRef.current = false;
      setMessage(data.error ?? "Gagal menyelesaikan asesmen.");
    }
  }

  useEffect(() => {
    if (mode !== "exam") return;
    const timer = window.setInterval(() => void saveCurrent(), 30000);
    return () => window.clearInterval(timer);
  }, [mode, current?.id, answers]);

  useEffect(() => {
    if (mode !== "exam" || remainingSeconds === null) return;
    if (isTkaMode) return;
    if (remainingSeconds <= 0) {
      void finish(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setRemainingSeconds((value) => value === null ? null : Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [mode, remainingSeconds, isTkaMode]);

  useEffect(() => {
    if (mode !== "exam" || !isTkaMode || !current) return;
    if (questionSecondsLeft <= 0) {
      void (async () => {
        await saveCurrent(true);
        setExpiredQuestionIndexes((prev) => new Set([...prev, index]));
        if (index >= questions.length - 1) {
          await finish(true);
          return;
        }
        setIndex((value) => Math.min(value + 1, questions.length - 1));
        setActiveMatchLeft(null);
        setQuestionSecondsLeft(60);
      })();
      return;
    }
    const timer = window.setTimeout(() => {
      setQuestionSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [mode, isTkaMode, current?.id, questionSecondsLeft, index, questions.length]);

  useEffect(() => {
    function tick() {
      const now = new Date();
      setNowText(now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setTodayText(fullDate(now));
      setTodayKey(jakartaDateKey(now));
    }
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mode !== "dashboard") return;
    const timer = window.setInterval(() => void loadDashboard(), 15000);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    if (mode !== "dashboard") return;
    void loadDashboard();
  }, [todayKey]);

  useEffect(() => {
    if (!["Soal berhasil direfresh.", "Dashboard sudah diperbarui."].includes(message)) return;
    const timer = window.setTimeout(() => {
      setMessage((currentMessage) => ["Soal berhasil direfresh.", "Dashboard sudah diperbarui."].includes(currentMessage) ? "" : currentMessage);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (mode === "mode_select") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#0f766e_0,#0b2545_34%,#12385c_68%,#0b2545_100%)]">
        <Header />
        <section className="mx-auto max-w-md px-6 pb-10 pt-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/12 p-5 text-white shadow-2xl backdrop-blur">
            <h2 className="text-center text-3xl font-black">Pilih Mode</h2>
            <p className="mt-2 text-center text-sm font-medium text-cyan-100">Masuk sesuai kebutuhan ujian hari ini.</p>
            <div className="mt-7 grid gap-3">
              <button onClick={() => void chooseAppMode("asesmen")} className="rounded-[1.5rem] bg-white p-5 text-left text-navy-900 shadow-lg">
                <div className="text-xs font-black uppercase tracking-wide text-cyan-700">Mode Sekolah</div>
                <div className="mt-1 text-2xl font-black">Asesmen</div>
                <p className="mt-2 text-sm font-semibold text-slate-600">Untuk ujian mapel resmi sesuai jadwal proktor.</p>
              </button>
              <button onClick={() => void chooseAppMode("tka")} className="rounded-[1.5rem] bg-lime-300 p-5 text-left text-navy-900 shadow-lg shadow-black/20">
                <div className="text-xs font-black uppercase tracking-wide text-navy-700">Mode Latihan</div>
                <div className="mt-1 text-2xl font-black">Simulasi TKA</div>
                <p className="mt-2 text-sm font-semibold text-navy-800">1 soal 1 menit, otomatis lanjut, hasil langsung tampil.</p>
              </button>
            </div>
            {loading ? <p className="mt-4 text-center text-sm font-semibold text-cyan-100">Mengecek sesi login...</p> : null}
          </div>
        </section>
      </main>
    );
  }

  if (mode === "login") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#0f766e_0,#0b2545_34%,#12385c_68%,#0b2545_100%)]">
        <button onClick={() => setMode("mode_select")} className="absolute left-5 top-5 rounded-full bg-white/10 p-3 text-white backdrop-blur">
          <ArrowLeft />
        </button>
        <Header />
        <section className="mx-auto max-w-md px-6 pb-10 pt-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/12 p-5 shadow-2xl backdrop-blur">
            <h2 className="text-center text-3xl font-black text-white">Masuk {appMode === "tka" ? "Simulasi TKA" : "Asesmen"}</h2>
            <p className="mt-2 text-center text-sm font-medium text-cyan-100">Siapkan username, password, dan token dari proktor.</p>
            <label className="mt-7 flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 py-4 text-white">
              <UserRound size={22} className="text-cyan-100" />
              <input value={username} onChange={(event) => setUsername(event.target.value)} className="w-full bg-transparent font-semibold outline-none placeholder:text-white/45" placeholder="Username siswa" />
            </label>
            <label className="mt-4 flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 py-4 text-white">
              <Lock size={22} className="text-cyan-100" />
              <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} className="w-full bg-transparent font-semibold outline-none placeholder:text-white/45" placeholder="Password" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="rounded-full p-1 text-white/80">
                {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
              </button>
            </label>
            {message ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</p> : null}
            <button onClick={login} disabled={loading} className="mx-auto mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-lime-300 px-5 py-4 text-base font-black text-navy-900 shadow-lg shadow-black/20 disabled:opacity-60">
              <LogIn size={18} />
              {loading ? "Memproses..." : "Masuk ke PADU"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (mode === "dashboard") {
    return (
      <main className="min-h-screen bg-[#eef7f8]">
        <BrandHeader />
        <section className="mx-auto max-w-2xl px-4 py-5">
          <div className="-mt-8 rounded-[1.5rem] bg-white p-4 shadow-lg shadow-navy-900/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-cyan-700">Peserta</p>
                <h2 className="mt-1 text-xl font-black leading-tight text-navy-900">{student?.fullName}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{student?.className ?? "-"} - Ruang {student?.roomName ?? "-"}</p>
              </div>
              <div className="rounded-2xl bg-lime-100 p-2.5 text-navy-900">
                <ShieldCheck size={22} />
              </div>
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-cyan-50 px-3 py-2.5 text-xs font-bold text-cyan-900"><CalendarDays size={16} /> {todayText} <span className="rounded-full bg-navy-900 px-2.5 py-1 text-xs text-white">{nowText}</span></p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <button onClick={loadDashboard} className="inline-flex items-center justify-center gap-1.5 rounded-2xl border bg-white px-2 py-2.5 font-bold text-navy-900">
                <RefreshCw size={16} />
                Refresh
              </button>
              <button onClick={updateApp} className="inline-flex items-center justify-center gap-1.5 rounded-2xl border bg-white px-2 py-2.5 font-bold text-navy-900">
                <RotateCw size={16} />
                Update
              </button>
              <button onClick={logout} className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 px-2 py-2.5 font-bold text-red-700">
                <LogOut size={16} />
                Keluar
              </button>
            </div>
          </div>
          <h2 className="mt-5 text-xl font-black text-navy-900">{appMode === "tka" ? "Simulasi TKA Hari Ini" : "Mapel Hari Ini"}</h2>
          <div className="mt-3 grid gap-3">
            {exams.length === 0 ? <p className="rounded-[1.5rem] bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm">Belum ada {appMode === "tka" ? "simulasi TKA" : "mapel"} aktif hari ini.</p> : null}
            {exams.map((item) => {
              const cardClass = "w-full rounded-[1.5rem] bg-white p-4 text-left shadow-md shadow-navy-900/5";
              const content = (
                <>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-bold text-cyan-700">{item.exams.subjects?.subject_name ?? "Mapel"}</div>
                  <BookOpen size={22} className="text-lime-600" />
                </div>
                <div className="mt-1 text-lg font-bold text-navy-900">{item.exams.title}</div>
                <div className="mt-1 text-sm text-slate-600">{examDateText(item.exams.start_time)}</div>
                <div className="mt-1 text-sm text-slate-600">{item.exams.duration_minutes} menit - {item.exams.total_questions} soal</div>
                {item.status === "finished" ? (
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 rounded-2xl bg-cyan-50 px-3 py-2.5 text-xs font-black text-navy-900 sm:text-sm">
                    <span>Nilai : {item.result?.final_score ?? item.final_score ?? "-"}</span>
                    <span>Benar : {item.result?.correct_count ?? 0}</span>
                    <span>Salah : {item.result?.wrong_count ?? 0}</span>
                    <span>Tidak Diisi : {item.result?.empty_count ?? 0}</span>
                  </div>
                ) : null}
                <div className="mt-3 inline-flex rounded-full bg-lime-100 px-3 py-1 text-sm font-bold text-navy-900">{statusText[item.status] ?? item.status}</div>
                </>
              );
              return item.status === "finished" ? (
                <div key={item.id} className={cardClass}>{content}</div>
              ) : (
                <button key={item.id} onClick={() => enterToken(item)} className={cardClass}>{content}</button>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  if (mode === "token") {
    const locked = selected?.status === "locked";
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#0f766e_0,#0b2545_34%,#12385c_68%,#0b2545_100%)]">
        <button onClick={() => setMode("dashboard")} className="absolute left-5 top-5 rounded-full bg-white/10 p-3 text-white backdrop-blur">
          <ArrowLeft />
        </button>
        <Header />
        <section className="mx-auto max-w-md px-6 pb-10 pt-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/12 p-5 text-white shadow-2xl backdrop-blur">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-lime-300 text-navy-900">
              {locked ? <Lock size={30} /> : <KeyRound size={30} />}
            </div>
            <h2 className="mt-5 text-center text-3xl font-black">{locked ? "Buka Kunci" : appMode === "tka" ? "Token Simulasi TKA" : "Token Asesmen"}</h2>
            <p className="mt-2 text-center text-sm font-medium text-cyan-100">{locked ? "Masukkan token unlock dari proktor." : selected?.exams.title}</p>
            <input value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-7 w-full rounded-full border border-white/15 bg-white/10 px-5 py-5 text-center text-3xl font-black tracking-[0.35em] text-white outline-none placeholder:text-white/35" placeholder="000000" />
            {message ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</p> : null}
            <button onClick={startExam} disabled={loading} className="mt-7 w-full rounded-full bg-lime-300 px-4 py-4 font-black text-navy-900 shadow-lg shadow-black/20 disabled:opacity-60">{locked ? "Buka Kunci" : "Mulai Asesmen"}</button>
          </div>
        </section>
      </main>
    );
  }

  if (mode === "finished") {
    return (
      <main className="min-h-screen bg-slate-100">
        <Header />
        <section className="mx-auto max-w-md px-5 py-10 text-center">
          <CheckCircle className="mx-auto text-green-600" size={72} />
          <h2 className="mt-4 text-2xl font-bold text-navy-900">Asesmen Selesai</h2>
          <p className="mt-2 text-slate-600">Jawaban Anda sudah dikirim.</p>
          <div className="mt-5 rounded-lg bg-white p-5 text-left shadow-sm">
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-500">Nilai</div>
              <div className="mt-1 text-4xl font-bold text-navy-900">{result?.final_score ?? "-"}</div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md bg-green-50 p-3 text-green-700">
                <div className="font-bold text-xl">{result?.correct_count ?? 0}</div>
                Benar
              </div>
              <div className="rounded-md bg-red-50 p-3 text-red-700">
                <div className="font-bold text-xl">{result?.wrong_count ?? 0}</div>
                Salah
              </div>
              <div className="rounded-md bg-slate-100 p-3 text-slate-700">
                <div className="font-bold text-xl">{result?.empty_count ?? 0}</div>
                Tidak diisi
              </div>
            </div>
          </div>
          <button onClick={loadDashboard} className="mt-6 w-full rounded-md bg-navy-900 px-4 py-3 font-semibold text-white">Kembali ke Dashboard</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#0b1f5c]">
      <section className="mx-auto max-w-2xl px-3 py-3 pb-28">
        <div className="flex items-center justify-between gap-3">
          <h1 className="truncate text-lg font-black text-[#0b1f5c]">{appMode === "tka" ? "TKA" : "Ujian"}: {selected?.exams.subjects?.subject_name ?? selected?.exams.title ?? "Asesmen"}</h1>
          <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-black shadow-sm ${remainingSeconds !== null && remainingSeconds <= 300 ? "border-red-100 bg-red-50 text-red-700" : "border-blue-100 bg-blue-50 text-blue-700"}`}>
            <Clock size={17} />
            {examTimerText}
          </div>
        </div>

        {showQuestionNav ? <div className="mt-4 rounded-2xl border border-blue-50 bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#0b1f5c]">Lihat Semua Soal</h2>
            <button onClick={() => setShowQuestionNav(false)} className="rounded-full px-2 text-blue-700">^</button>
          </div>
          <div className="mt-3 grid grid-cols-10 gap-1.5">
            {questions.map((question, questionIndex) => {
              const answered = answeredQuestionIds.has(question.id);
              const active = questionIndex === index;
              return (
                <button
                  key={question.id}
                  disabled={isTkaMode && expiredQuestionIndexes.has(questionIndex)}
                  onClick={async () => {
                    if (isTkaMode && expiredQuestionIndexes.has(questionIndex)) return;
                    await saveCurrent();
                    setIndex(questionIndex);
                    setActiveMatchLeft(null);
                    if (isTkaMode) setQuestionSecondsLeft(60);
                  }}
                  className={`h-7 rounded-md border text-[11px] font-black transition ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : answered
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-blue-300 bg-white text-blue-700"
                  } disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}
                >
                  {questionIndex + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[9px] font-semibold text-slate-500">
            <div className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-600" /> Sedang dikerjakan</div>
            <div className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-600" /> Sudah dijawab</div>
            <div className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-blue-300 bg-white" /> Belum dijawab</div>
          </div>
        </div> : null}

        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
          <div className="text-center text-sm font-black text-[#0b1f5c]">Soal {currentQuestionLabel} dari {questionTotalLabel}</div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="w-12 text-right text-sm font-black text-blue-600">{progressPercent}%</div>
          </div>
          <button onClick={() => setShowQuestionNav((value) => !value)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-sm">
            <Grid3X3 size={18} />
            Lihat semua
          </button>
          {isTkaMode ? (
            <button onClick={() => finish(false)} className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20">
              Selesai Simulasi & Lihat Nilai
            </button>
          ) : null}
        </div>
        {message ? <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
        {!current ? <p>Belum ada soal.</p> : (
          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
            <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
              {current.question_type === "matching" ? <Puzzle size={15} /> : current.question_type === "short_answer" ? <Check size={15} /> : <BookOpen size={15} />}
              {current.question_type === "matching" ? "Mencocokkan" : current.question_type === "short_answer" ? "Isian Singkat" : "Pilihan Ganda"}
            </div>
            <h2 className="mt-5 text-base font-black leading-relaxed text-[#0b1f5c]">{current.question_text}</h2>
            {current.media_type === "image" && current.media_url ? <img src={current.media_url} alt="Gambar soal" className="mt-3 max-h-72 w-full rounded-xl border object-contain" /> : null}
            <div className="mt-5 grid gap-3">
              {current.question_type === "multiple_choice" ? current.question_options?.map((option) => (
                <label key={option.option_label} className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 font-black transition ${answers[current.id]?.option === option.option_label ? "border-blue-600 bg-blue-50 text-[#0b1f5c]" : "border-slate-100 bg-white text-[#0b1f5c]"}`}>
                  <input className="sr-only" type="radio" checked={answers[current.id]?.option === option.option_label} onChange={() => setAnswers((prev) => ({ ...prev, [current.id]: { option: option.option_label } }))} />
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${answers[current.id]?.option === option.option_label ? "bg-blue-600 text-white" : "bg-slate-100 text-[#0b1f5c]"}`}>{option.option_label}</span>
                  <span className="flex-1">{option.option_text}</span>
                  {answers[current.id]?.option === option.option_label ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white"><Check size={16} strokeWidth={4} /></span> : null}
                </label>
              )) : current.question_type === "matching" ? (
                <div>
                  <p className="text-sm font-black leading-relaxed text-[#0b1f5c]">Pasangkan setiap pernyataan di kolom kiri dengan jawaban yang tepat di kolom kanan.</p>
                  <div className="relative mt-5">
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {Object.entries(answers[current.id]?.pairs ?? {}).map(([leftText, rightText], pairIndex) => {
                        const leftIndex = current.matching_items?.left.findIndex((item) => item.text === leftText) ?? -1;
                        const rightIndex = current.matching_items?.right.findIndex((item) => item.text === rightText) ?? -1;
                        if (leftIndex < 0 || rightIndex < 0) return null;
                        const rowCount = Math.max(current.matching_items?.left.length ?? 1, current.matching_items?.right.length ?? 1);
                        const leftY = 16 + (leftIndex * (72 / Math.max(1, rowCount - 1)));
                        const rightY = 16 + (rightIndex * (72 / Math.max(1, rowCount - 1)));
                        const colors = ["#0b63ff", "#22a524", "#8a2be2", "#ff7a1a", "#0891b2"];
                        const color = colors[pairIndex % colors.length];
                        return <path key={`${leftText}-${rightText}`} d={`M 42 ${leftY} C 50 ${leftY}, 50 ${rightY}, 58 ${rightY}`} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" />;
                      })}
                    </svg>
                    <div className="grid grid-cols-[1fr_44px_1fr] gap-2 text-[11px] font-black text-[#0b1f5c]">
                      <div>Pernyataan</div>
                      <div />
                      <div>Jawaban</div>
                    </div>
                    <div className="relative z-10 mt-3 grid grid-cols-[1fr_44px_1fr] gap-2">
                      <div className="grid gap-2">
                        {(current.matching_items?.left ?? []).map((item, itemIndex) => (
                          <button key={item.id} onClick={() => setActiveMatchLeft(item.text)} className={`flex min-h-14 items-center gap-2 rounded-xl border bg-white p-2 text-left text-xs font-black text-[#0b1f5c] shadow-sm ${activeMatchLeft === item.text ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-100"}`}>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">{itemIndex + 1}</span>
                            <span className="flex-1">{item.text}</span>
                            <span className={`h-3 w-3 rounded-full border-2 ${answers[current.id]?.pairs?.[item.text] ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"}`} />
                          </button>
                        ))}
                      </div>
                      <div />
                      <div className="grid gap-2">
                        {(current.matching_items?.right ?? []).map((item, itemIndex) => {
                          const used = Object.values(answers[current.id]?.pairs ?? {}).includes(item.text);
                          return (
                            <button key={item.id} onClick={() => activeMatchLeft ? setMatchingPair(current.id, activeMatchLeft, item.text) : undefined} className={`flex min-h-14 items-center gap-2 rounded-xl border bg-white p-2 text-left text-xs font-black text-[#0b1f5c] shadow-sm ${used ? "border-green-200 bg-green-50" : "border-slate-100"}`}>
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">{String.fromCharCode(65 + itemIndex)}</span>
                              <span className="flex-1">{item.text}</span>
                              <span className={`h-3 w-3 rounded-full border-2 ${used ? "border-green-600 bg-green-600" : "border-slate-300 bg-white"}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-[11px] font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1.5"><Info size={14} className="text-blue-600" /> Petunjuk: Tarik garis dari pernyataan ke jawaban yang tepat.</span>
                    <button onClick={() => resetMatching(current.id)} className="text-xs font-black text-blue-700">Reset</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-4 text-sm font-black text-[#0b1f5c]">Lengkapi titik-titik berikut dengan jawaban yang tepat.</p>
                  <textarea className="min-h-32 rounded-2xl border border-slate-200 p-4 font-semibold outline-none focus:border-blue-600" placeholder="Ketik jawaban di sini..." value={answers[current.id]?.text ?? ""} onChange={(event) => setAnswers((prev) => ({ ...prev, [current.id]: { text: event.target.value } }))} />
                  <div className="mt-2 text-right text-xs font-bold text-slate-400">{answers[current.id]?.text?.length ?? 0} / 20</div>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 px-3 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto grid max-w-2xl grid-cols-3 gap-3">
          <button disabled={index === 0 || (isTkaMode && expiredQuestionIndexes.has(index - 1))} onClick={() => move(index - 1)} className="rounded-lg border border-blue-500 bg-white px-3 py-3 text-sm font-black text-blue-700 disabled:opacity-50">Sebelumnya</button>
          <button onClick={refreshCurrentQuestion} className="rounded-lg border border-blue-500 bg-white px-3 py-3 text-sm font-black text-blue-700">Refresh Soal</button>
          {index === questions.length - 1 ? (
            <button onClick={() => isTkaMode ? finish(false) : setShowFinishConfirm(true)} className="rounded-lg bg-blue-600 px-3 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20">Selesai</button>
          ) : (
            <button onClick={() => move(index + 1)} className="rounded-lg bg-blue-600 px-3 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20">Berikutnya</button>
          )}
          </div>
        </div>
      </section>
      {showFinishConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/65 px-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amber-100 text-amber-500">
              <AlertTriangle size={56} strokeWidth={2.6} />
            </div>
            <h2 className="mt-5 text-2xl font-black text-navy-900">Apakah anda sudah yakin?</h2>
            <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-slate-200" />
            <p className="mx-auto mt-5 max-w-xs text-base font-semibold leading-relaxed text-slate-600">
              Silahkan cek kembali jawaban anda sebelum melanjutkan. Setelah selesai, jawaban tidak dapat diubah kembali.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-cyan-50 p-3 text-xs font-black text-navy-900">
              <div>Terjawab<br />{answeredCount}</div>
              <div>Belum Diisi<br />{Math.max(0, questions.length - answeredCount)}</div>
              <div>Total<br />{questions.length}</div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setShowFinishConfirm(false)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-navy-900 px-4 py-4 font-black text-navy-900">
                <ArrowLeft size={22} />
                Kembali
              </button>
              <button onClick={() => finish(false)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-4 font-black text-white shadow-lg shadow-red-900/20">
                <span className="rounded-full bg-white p-1 text-red-600"><Check size={16} strokeWidth={4} /></span>
                Selesai
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-400">
              <span>Kembali ke soal</span>
              <span>Kembali ke dashboard</span>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
