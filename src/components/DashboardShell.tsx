"use client";

import { BookOpen, Database, GraduationCap, KeyRound, Monitor, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AppSession } from "@/lib/session";

const icons = {
  users: Users,
  book: BookOpen,
  key: KeyRound,
  monitor: Monitor,
  database: Database,
  cap: GraduationCap
};

export type MenuItem = {
  label: string;
  icon: keyof typeof icons;
  href?: string;
};

function slug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function DashboardShell({
  title,
  subtitle,
  session,
  menu,
  children
}: {
  title: string;
  subtitle: string;
  session: AppSession;
  menu: MenuItem[];
  children: React.ReactNode;
}) {
  const [activeHref, setActiveHref] = useState(menu[0]?.href ?? `#${slug(menu[0]?.label ?? "")}`);

  useEffect(() => {
    function syncHash() {
      if (window.location.hash) setActiveHref(window.location.hash);
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <main className="min-h-screen bg-[#eef7f8]">
      <aside className="fixed inset-y-0 left-0 hidden w-72 bg-gradient-to-b from-navy-900 via-navy-800 to-cyan-900 p-6 text-white lg:block">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-3">
          <img src="/padu-logo.png" alt="Logo PADU" className="h-16 w-16 object-contain drop-shadow-lg" />
          <div>
            <div className="text-3xl font-black">PADU</div>
            <div className="mt-1 text-sm font-semibold text-cyan-100">Portal Asesmen Dua Ciksel</div>
          </div>
        </div>
        </div>
        <nav className="mt-8 space-y-2">
          {menu.map((item) => {
            const Icon = icons[item.icon];
            const href = item.href ?? `#${slug(item.label)}`;
            const active = activeHref === href;
            return (
              <a
                key={item.label}
                href={href}
                onClick={() => setActiveHref(href)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-bold transition ${active ? "bg-lime-300 text-navy-900 shadow-lg shadow-black/10" : "text-blue-50 hover:bg-white/10"}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>
      <section className="lg:pl-72">
        <header className="bg-gradient-to-br from-navy-900 via-navy-800 to-cyan-800 px-5 pb-14 pt-5 text-white lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">{title}</h1>
              <p className="mt-1 text-sm font-semibold text-cyan-100">{subtitle}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-right text-sm backdrop-blur">
              <div className="font-semibold">{session.fullName}</div>
              <div className="uppercase text-cyan-100">{session.role}</div>
            </div>
          </div>
        </header>
        <div className="-mt-8 px-5 py-6 lg:px-8">{children}</div>
        <footer className="px-5 pb-6 text-xs text-slate-500 lg:px-8">
          <Link href="/" className="font-bold text-navy-700">Kembali ke login</Link>
        </footer>
      </section>
    </main>
  );
}
