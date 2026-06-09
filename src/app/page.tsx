"use client";

import { LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, app: "dashboard" })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Login gagal.");
      return;
    }
    const destination =
      data.user.role === "teacher"
        ? "guru"
        : data.user.role === "proctor"
          ? "proktor"
          : data.user.role;
    window.location.href = `/dashboard/${destination}`;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_34%),linear-gradient(135deg,#0b2545,#12385c)] px-4 py-8 text-navy-900">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div className="text-white">
          <img src="/padu-logo.png" alt="Logo PADU" className="mb-6 h-32 w-32 object-contain" />
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm">
            <ShieldCheck size={18} />
            SMAN 2 Cikarang Selatan
          </div>
          <h1 className="text-5xl font-bold tracking-normal">PADU Dashboard</h1>
          <p className="mt-3 text-xl text-blue-100">Portal Asesmen Dua Ciksel</p>
          <p className="mt-5 max-w-xl text-blue-50">
            PADU: Solid Sistemnya, Jujur Asesmennya. Kelola asesmen digital dengan alur resmi,
            stabil, dan hemat request untuk skala sekolah.
          </p>
        </div>
        <form onSubmit={submit} className="rounded-lg bg-white p-6 shadow-2xl">
          <h2 className="text-2xl font-semibold">Masuk Dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">Khusus admin, guru, dan proktor.</p>
          <label className="mt-6 block text-sm font-medium">Username</label>
          <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 outline-none focus:border-navy-600" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label className="mt-4 block text-sm font-medium">Password</label>
          <input type="password" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 outline-none focus:border-navy-600" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy-900 px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={loading}>
            <LogIn size={18} />
            {loading ? "Memproses..." : "Masuk ke PADU"}
          </button>
          <a href="/student" className="mt-3 block text-center text-sm font-semibold text-navy-700">
            Buka App Siswa
          </a>
        </form>
      </section>
    </main>
  );
}
