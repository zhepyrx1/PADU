"use client";

import { FileText, ImagePlus, Plus, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type QuestionType = "multiple_choice" | "short_answer" | "matching";
type Option = { label: string; text: string; isCorrect: boolean };
type Pair = { left: string; right: string };
type Exam = {
  id: string;
  title: string;
  grade_level?: number | null;
  duration_minutes?: number;
  total_questions?: number;
  subjects?: { subject_name?: string; subject_code?: string } | null;
};
type DraftQuestion = {
  questionText: string;
  questionType: QuestionType;
  options?: Option[];
  shortAnswers?: string[];
  pairs?: Pair[];
};
type SavedQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  score?: number | null;
  order_number?: number | null;
};
type SyncQuestion = SavedQuestion & {
  question_options?: { option_label: string; option_text: string; is_correct?: boolean; order_number?: number }[];
  question_answer_keys?: { answer_key: { answers?: string[]; pairs?: Pair[] } }[];
};
type SyncParticipant = {
  id: string;
  status: string;
  final_score?: number | null;
  students?: { room_name?: string | null; profiles?: { full_name?: string }; classes?: { class_name?: string } };
  student_answers?: { question_id: string; answer?: Record<string, string>; is_correct?: boolean | null; score_obtained?: number | null }[];
};

const emptyOptions: Option[] = ["A", "B", "C", "D", "E"].map((label) => ({ label, text: "", isCorrect: label === "A" }));

export function QuestionBuilder() {
  const [activeSection, setActiveSection] = useState("mapel-saya");
  const [examMode, setExamMode] = useState<"asesmen" | "tka">("asesmen");
  const [gradeLevel, setGradeLevel] = useState<10 | 11 | 12>(11);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("multiple_choice");
  const [questionText, setQuestionText] = useState("");
  const [score, setScore] = useState(1);
  const [orderNumber, setOrderNumber] = useState(1);
  const [options, setOptions] = useState<Option[]>(emptyOptions);
  const [shortAnswers, setShortAnswers] = useState<string[]>([""]);
  const [pairs, setPairs] = useState<Pair[]>([{ left: "", right: "" }, { left: "", right: "" }]);
  const [mediaPath, setMediaPath] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [draftIndex, setDraftIndex] = useState<number | null>(null);
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([]);
  const [syncQuestions, setSyncQuestions] = useState<SyncQuestion[]>([]);
  const [syncParticipants, setSyncParticipants] = useState<SyncParticipant[]>([]);
  const filteredExams = useMemo(() => exams.filter((exam) => {
    const title = `${exam.title ?? ""} ${exam.subjects?.subject_name ?? ""}`.toLowerCase();
    const isTka = title.includes("tka") || title.includes("tes kemampuan akademik");
    return (exam.grade_level ?? 11) === gradeLevel && (examMode === "tka" ? isTka : !isTka);
  }), [exams, gradeLevel, examMode]);

  function sectionClass(id: string, className: string) {
    return activeSection === id ? className : `${className} hidden`;
  }

  useEffect(() => {
    async function loadExams() {
      const response = await fetch("/api/exams");
      const data = await response.json();
      setExams(data.exams ?? []);
    }
    void loadExams();
  }, []);

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.replace("#", "");
      if (hash) setActiveSection(hash);
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    const first = filteredExams[0]?.id ?? "";
    setExamId((current) => filteredExams.some((exam) => exam.id === current) ? current : first);
  }, [filteredExams]);

  useEffect(() => {
    void loadSavedQuestions(examId);
    void loadExamSync(examId);
  }, [examId]);

  async function loadSavedQuestions(targetExamId = examId) {
    if (!targetExamId) {
      setSavedQuestions([]);
      return;
    }
    const response = await fetch(`/api/questions?examId=${targetExamId}`);
    const data = await response.json();
    setSavedQuestions(data.questions ?? []);
  }

  async function loadExamSync(targetExamId = examId) {
    if (!targetExamId) {
      setSyncQuestions([]);
      setSyncParticipants([]);
      return;
    }
    const response = await fetch(`/api/teacher/exam-sync?examId=${targetExamId}`);
    const data = await response.json();
    setSyncQuestions(data.questions ?? []);
    setSyncParticipants(data.participants ?? []);
  }

  function resetQuestionForm() {
    setQuestionType("multiple_choice");
    setQuestionText("");
    setScore(1);
    setOrderNumber(1);
    setOptions(emptyOptions);
    setShortAnswers([""]);
    setPairs([{ left: "", right: "" }, { left: "", right: "" }]);
    setMediaPath("");
    setDraftIndex(null);
    setMessage("Form soal sudah direset.");
  }

  async function deleteQuestion(question: SavedQuestion) {
    const label = question.order_number ? `nomor ${question.order_number}` : "ini";
    if (!window.confirm(`Hapus soal ${label}?`)) return;
    setMessage("Menghapus soal...");
    const response = await fetch(`/api/questions?questionId=${question.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Gagal menghapus soal.");
      return;
    }
    setMessage(`Soal ${label} berhasil dihapus.`);
    await loadSavedQuestions();
    await loadExamSync();
  }

  async function uploadImage(file: File) {
    setMessage("Mengupload gambar...");
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "umum");
    const response = await fetch("/api/media/upload", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Upload gambar gagal.");
      return;
    }
    setMediaPath(data.path);
    setMessage("Gambar berhasil diupload dan otomatis terhubung ke soal.");
  }

  async function importWord(file: File) {
    setMessage("Membaca file Word...");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/questions/import-word", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Import Word gagal.");
      return;
    }
    const importedDrafts: DraftQuestion[] = data.drafts ?? [];
    setDrafts(importedDrafts);
    if (importedDrafts.length > 0) {
      loadDraft(importedDrafts[0], 0);
      setMessage(`${importedDrafts.length} draft soal terbaca dari Word. Soal 1 otomatis masuk ke form.`);
      setActiveSection("input-soal");
      window.location.hash = "input-soal";
      return;
    }
    setDraftIndex(null);
    setMessage("Belum ada soal yang terbaca dari Word. Cek format naskahnya.");
  }

  function loadDraft(draft: DraftQuestion, index?: number) {
    setQuestionType(draft.questionType);
    setQuestionText(draft.questionText);
    setOptions(draft.options?.length ? draft.options : emptyOptions);
    setShortAnswers(draft.shortAnswers?.length ? draft.shortAnswers : [""]);
    setPairs(draft.pairs?.length ? draft.pairs : [{ left: "", right: "" }]);
    if (typeof index === "number") {
      setDraftIndex(index);
      setOrderNumber(index + 1);
    }
    setMessage("Draft dimasukkan ke form. Cek lagi, lalu klik Simpan Soal.");
  }

  async function saveQuestion() {
    if (!examId) {
      setMessage(`Belum ada asesmen/simulasi untuk kelas ${gradeLevel}. Minta proktor membuat paket ujian terlebih dahulu.`);
      return;
    }
    setMessage("Menyimpan soal...");
    const payload = {
      examId,
      questionType,
      questionText,
      score,
      orderNumber,
      mediaPath: mediaPath || null,
      options,
      shortAnswers,
      pairs
    };
    const response = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Soal gagal disimpan.");
      return;
    }
    if (draftIndex !== null && drafts[draftIndex + 1]) {
      const nextIndex = draftIndex + 1;
      loadDraft(drafts[nextIndex], nextIndex);
      setMediaPath("");
      await loadSavedQuestions();
      await loadExamSync();
      setMessage(`Soal berhasil disimpan. Soal ${nextIndex + 1} dari Word otomatis masuk ke form.`);
      return;
    }
    setMessage("Soal berhasil disimpan.");
    setQuestionText("");
    setMediaPath("");
    setOrderNumber((value) => value + 1);
    await loadSavedQuestions();
    await loadExamSync();
  }

  function keyText(question: SyncQuestion) {
    if (question.question_type === "multiple_choice") {
      return question.question_options?.filter((option) => option.is_correct).map((option) => option.option_label).join(", ") || "-";
    }
    const key = question.question_answer_keys?.[0]?.answer_key;
    if (key?.answers?.length) return key.answers.join("; ");
    if (key?.pairs?.length) return key.pairs.map((pair) => `${pair.left} = ${pair.right}`).join("; ");
    return "-";
  }

  function answerText(answer?: Record<string, string>) {
    if (!answer) return "-";
    return answer.option ?? answer.text ?? JSON.stringify(answer);
  }

  return (
    <div className="grid gap-6">
      <section id="mapel-saya" className={sectionClass("mapel-saya", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <h2 className="text-lg font-semibold text-navy-900">Mapel Saya</h2>
        <p className="mt-1 text-sm text-slate-600">Pilih mode Asesmen atau Simulasi TKA. Bank soal dan kunci yang tampil dipisah sesuai akun guru yang login.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <button onClick={() => setExamMode("asesmen")} className={`rounded-md border px-4 py-3 text-left font-semibold ${examMode === "asesmen" ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}>
            Asesmen
            <span className="mt-1 block text-xs font-medium opacity-80">Untuk bank soal ujian mapel sekolah.</span>
          </button>
          <button onClick={() => setExamMode("tka")} className={`rounded-md border px-4 py-3 text-left font-semibold ${examMode === "tka" ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}>
            Simulasi TKA
            <span className="mt-1 block text-xs font-medium opacity-80">Untuk bank soal khusus simulasi TKA.</span>
          </button>
        </div>
      </section>

      <section id="input-soal" className={sectionClass("input-soal", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <h2 className="text-lg font-semibold text-navy-900">Buat Soal Mudah</h2>
        <div className="mt-4 rounded-md border p-4">
          <h3 className="flex items-center gap-2 font-semibold text-navy-900">
            <FileText size={18} />
            Import Word
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Upload file .docx. Format mudah: tulis <b>Soal:</b>, pilihan <b>A.</b> sampai <b>E.</b>, lalu <b>Kunci:</b>.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm">
            <Upload size={16} />
            Upload Word
            <input type="file" accept=".docx" className="hidden" onChange={(event) => event.target.files?.[0] && importWord(event.target.files[0])} />
          </label>
        </div>
        <div className="mt-4">
          <div className="text-sm font-medium">Pilih Kelas</div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {[10, 11, 12].map((grade) => (
              <button
                key={grade}
                onClick={() => setGradeLevel(grade as 10 | 11 | 12)}
                className={`rounded-md border px-4 py-3 text-left font-semibold ${gradeLevel === grade ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}
              >
                Kelas {grade}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_120px]">
          <label className="text-sm font-medium">
            Pilih {examMode === "tka" ? "Simulasi TKA" : "Asesmen"}
            <select value={examId} onChange={(event) => setExamId(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2">
              {filteredExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.subjects?.subject_name ?? "Mapel"} - {exam.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            No. Soal
            <input type="number" value={orderNumber} onChange={(event) => setOrderNumber(Number(event.target.value))} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
          <label className="text-sm font-medium">
            Nilai
            <input type="number" value={score} onChange={(event) => setScore(Number(event.target.value))} className="mt-1 w-full rounded-md border px-3 py-2" />
          </label>
        </div>
        {filteredExams.length === 0 ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Belum ada {examMode === "tka" ? "simulasi TKA" : "asesmen"} untuk kelas {gradeLevel}. Proktor perlu membuat paket dan memilih kelas peserta terlebih dahulu.
          </p>
        ) : null}
        {drafts.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-navy-900">
            <span className="font-semibold">Draft Word: soal {(draftIndex ?? 0) + 1} dari {drafts.length}</span>
            <div className="flex gap-2">
              <button
                onClick={() => draftIndex !== null && drafts[draftIndex - 1] && loadDraft(drafts[draftIndex - 1], draftIndex - 1)}
                disabled={draftIndex === null || draftIndex <= 0}
                className="rounded-md border bg-white px-3 py-1 disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => {
                  const nextIndex = draftIndex === null ? 0 : draftIndex + 1;
                  if (drafts[nextIndex]) loadDraft(drafts[nextIndex], nextIndex);
                }}
                disabled={draftIndex !== null && draftIndex >= drafts.length - 1}
                className="rounded-md border bg-white px-3 py-1 disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {[
            ["multiple_choice", "Pilihan Ganda"],
            ["short_answer", "Isian Singkat"],
            ["matching", "Mencocokkan"]
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setQuestionType(value as QuestionType)}
              className={`rounded-md border px-4 py-3 text-left font-semibold ${questionType === value ? "border-navy-900 bg-navy-900 text-white" : "bg-white text-navy-900"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-medium">
          Pertanyaan
          <textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={4} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Tulis pertanyaan seperti di naskah soal." />
        </label>

        <div className="mt-4 rounded-md border border-dashed p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-navy-900">Gambar Soal Opsional</h3>
              <p className="text-sm text-slate-600">Pilih gambar WebP/JPG maksimal 300 KB. Sistem otomatis menyimpan path gambar.</p>
              {mediaPath ? <p className="mt-1 text-sm text-green-700">Terhubung: {mediaPath}</p> : null}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm">
              <ImagePlus size={16} />
              Pilih Gambar
              <input type="file" accept="image/webp,image/jpeg" className="hidden" onChange={(event) => event.target.files?.[0] && uploadImage(event.target.files[0])} />
            </label>
          </div>
        </div>

        {questionType === "multiple_choice" ? (
          <div className="mt-4 grid gap-2">
            <h3 className="font-semibold text-navy-900">Pilihan Jawaban</h3>
            {options.map((option, index) => (
              <div key={option.label} className="grid gap-2 md:grid-cols-[44px_1fr_140px]">
                <div className="rounded-md bg-slate-100 px-3 py-2 text-center font-bold">{option.label}</div>
                <input value={option.text} onChange={(event) => setOptions((prev) => prev.map((item, i) => i === index ? { ...item, text: event.target.value } : item))} className="rounded-md border px-3 py-2" placeholder={`Pilihan ${option.label}`} />
                <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input type="radio" name="correct" checked={option.isCorrect} onChange={() => setOptions((prev) => prev.map((item, i) => ({ ...item, isCorrect: i === index })))} />
                  Kunci
                </label>
              </div>
            ))}
          </div>
        ) : null}

        {questionType === "short_answer" ? (
          <div className="mt-4 grid gap-2">
            <h3 className="font-semibold text-navy-900">Jawaban Benar yang Diterima</h3>
            <p className="text-sm text-slate-600">Teks biasa tidak sensitif huruf besar-kecil dan tanda baca ringan. Jawaban angka, rumus, dan satuan tetap dinilai lebih presisi.</p>
            {shortAnswers.map((answer, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_auto]">
                <input value={answer} onChange={(event) => setShortAnswers((prev) => prev.map((item, i) => i === index ? event.target.value : item))} className="rounded-md border px-3 py-2" placeholder="Contoh: Bandung" />
                <button onClick={() => setShortAnswers((prev) => prev.filter((_, i) => i !== index))} className="rounded-md border px-3 py-2"><Trash2 size={16} /></button>
              </div>
            ))}
            <button onClick={() => setShortAnswers((prev) => [...prev, ""])} className="inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm"><Plus size={16} /> Tambah variasi jawaban</button>
          </div>
        ) : null}

        {questionType === "matching" ? (
          <div className="mt-4 grid gap-2">
            <h3 className="font-semibold text-navy-900">Tabel Mencocokkan</h3>
            <div className="grid grid-cols-2 gap-2 text-sm font-semibold text-slate-600">
              <div>Kolom Kiri</div>
              <div>Pasangan Benar di Kolom Kanan</div>
            </div>
            {pairs.map((pair, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input value={pair.left} onChange={(event) => setPairs((prev) => prev.map((item, i) => i === index ? { ...item, left: event.target.value } : item))} className="rounded-md border px-3 py-2" placeholder="Contoh: Ki Hajar Dewantara" />
                <input value={pair.right} onChange={(event) => setPairs((prev) => prev.map((item, i) => i === index ? { ...item, right: event.target.value } : item))} className="rounded-md border px-3 py-2" placeholder="Contoh: Pendidikan Nasional" />
                <button onClick={() => setPairs((prev) => prev.filter((_, i) => i !== index))} className="rounded-md border px-3 py-2"><Trash2 size={16} /></button>
              </div>
            ))}
            <button onClick={() => setPairs((prev) => [...prev, { left: "", right: "" }])} className="inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm"><Plus size={16} /> Tambah baris</button>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={saveQuestion} className="inline-flex items-center gap-2 rounded-md bg-navy-900 px-5 py-3 font-semibold text-white">
            <Save size={18} />
            Simpan Soal
          </button>
          <button onClick={resetQuestionForm} className="inline-flex items-center gap-2 rounded-md border border-red-200 px-5 py-3 font-semibold text-red-700">
            <Trash2 size={18} />
            Reset Form Soal
          </button>
        </div>
        {message ? <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
        <div className="mt-6 rounded-md border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-navy-900">Hapus Soal per Nomor</h3>
              <p className="text-sm text-slate-600">Daftar soal dari asesmen yang sedang dipilih.</p>
            </div>
            <button onClick={() => loadSavedQuestions()} className="rounded-md border px-3 py-2 text-sm">Refresh Daftar</button>
          </div>
          <div className="mt-3 grid gap-2">
            {savedQuestions.length === 0 ? <p className="text-sm text-slate-500">Belum ada soal tersimpan di asesmen ini.</p> : null}
            {savedQuestions.map((question) => (
              <div key={question.id} className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm md:grid-cols-[90px_1fr_auto]">
                <div className="font-bold text-navy-900">No. {question.order_number ?? "-"}</div>
                <div className="truncate">{question.question_text}</div>
                <button onClick={() => deleteQuestion(question)} className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 font-semibold text-red-700">
                  <Trash2 size={16} />
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="bank-soal" className={sectionClass("bank-soal", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <h2 className="text-lg font-semibold text-navy-900">Bank Soal</h2>
        <p className="mt-1 text-sm text-slate-600">Soal tersinkron dari asesmen yang sedang dipilih.</p>
        <button onClick={() => loadExamSync()} className="mt-3 rounded-md border px-3 py-2 text-sm">Refresh Data</button>
        <div className="mt-4 grid gap-2">
          {syncQuestions.length === 0 ? <p className="text-sm text-slate-500">Belum ada soal.</p> : null}
          {syncQuestions.map((question) => (
            <div key={question.id} className="rounded-md border p-3 text-sm">
              <div className="font-bold text-navy-900">No. {question.order_number ?? "-"} - {question.question_type}</div>
              <div className="mt-1">{question.question_text}</div>
              <div className="mt-1 text-slate-600">Nilai: {question.score ?? 1}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="kunci-jawaban" className={sectionClass("kunci-jawaban", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <h2 className="text-lg font-semibold text-navy-900">Kunci Jawaban</h2>
        <p className="mt-1 text-sm text-slate-600">Kunci tersinkron dari soal yang sudah disimpan.</p>
        <button onClick={() => loadExamSync()} className="mt-3 rounded-md border px-3 py-2 text-sm">Refresh Data</button>
        <div className="mt-4 grid gap-2">
          {syncQuestions.length === 0 ? <p className="text-sm text-slate-500">Belum ada kunci.</p> : null}
          {syncQuestions.map((question) => (
            <div key={question.id} className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm md:grid-cols-[90px_1fr]">
              <div className="font-bold text-navy-900">No. {question.order_number ?? "-"}</div>
              <div>{keyText(question)}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="hasil-jawaban" className={sectionClass("hasil-jawaban", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <h2 className="text-lg font-semibold text-navy-900">Hasil Jawaban</h2>
        <p className="mt-1 text-sm text-slate-600">Jawaban siswa tersinkron dari asesmen terpilih.</p>
        <button onClick={() => loadExamSync()} className="mt-3 rounded-md border px-3 py-2 text-sm">Refresh Data</button>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4">Siswa</th>
                <th className="py-2 pr-4">Kelas</th>
                <th className="py-2 pr-4">Jawaban</th>
              </tr>
            </thead>
            <tbody>
              {syncParticipants.map((participant) => (
                <tr key={participant.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{participant.students?.profiles?.full_name ?? "-"}</td>
                  <td className="py-2 pr-4">{participant.students?.classes?.class_name ?? "-"}</td>
                  <td className="py-2 pr-4">
                    {(participant.student_answers ?? []).map((answer) => {
                      const question = syncQuestions.find((item) => item.id === answer.question_id);
                      return `No. ${question?.order_number ?? "-"}: ${answerText(answer.answer)}`;
                    }).join(" | ") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="rekap-nilai" className={sectionClass("rekap-nilai", "scroll-mt-6 rounded-lg bg-white p-5 shadow-sm")}>
        <h2 className="text-lg font-semibold text-navy-900">Rekap Nilai</h2>
        <p className="mt-1 text-sm text-slate-600">Nilai akhir tersinkron dari peserta asesmen.</p>
        <button onClick={() => loadExamSync()} className="mt-3 rounded-md border px-3 py-2 text-sm">Refresh Data</button>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4">Siswa</th>
                <th className="py-2 pr-4">Kelas</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {syncParticipants.map((participant) => (
                <tr key={participant.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{participant.students?.profiles?.full_name ?? "-"}</td>
                  <td className="py-2 pr-4">{participant.students?.classes?.class_name ?? "-"}</td>
                  <td className="py-2 pr-4">{participant.status}</td>
                  <td className="py-2 pr-4 font-bold">{participant.final_score ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
