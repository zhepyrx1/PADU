"use client";

import { Plus, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";

type Field = { name: string; label: string; type?: string; placeholder?: string };

export function ResourcePanel({ resource, title, fields, id }: { resource: string; title: string; fields: Field[]; id?: string }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/admin/${resource}`);
    const data = await response.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  async function create() {
    setMessage("");
    const response = await fetch(`/api/admin/${resource}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setMessage(response.ok ? "Data tersimpan." : data.error ?? "Gagal menyimpan.");
    if (response.ok) {
      setForm({});
      await load();
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section id={id} className="scroll-mt-6 rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <RefreshCw size={16} />
          Muat
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <label key={field.name} className="text-sm font-medium">
            {field.label}
            <input
              type={field.type ?? "text"}
              placeholder={field.placeholder}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={form[field.name] ?? ""}
              onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))}
            />
          </label>
        ))}
      </div>
      <button onClick={create} className="mt-4 inline-flex items-center gap-2 rounded-md bg-navy-900 px-4 py-2 text-white">
        <Save size={16} />
        Simpan
      </button>
      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      <div className="mt-5 overflow-x-auto">
        {loading ? <p>Memuat...</p> : null}
        {!loading && items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-slate-50 p-4 text-sm text-slate-500">
            <Plus size={16} />
            Belum ada data.
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                {Object.keys(items[0] ?? {}).slice(0, 6).map((key) => <th key={key} className="py-2 pr-4 font-semibold">{key}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={String(item.id ?? index)} className="border-b last:border-0">
                  {Object.keys(items[0] ?? {}).slice(0, 6).map((key) => <td key={key} className="py-2 pr-4">{String(item[key] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
