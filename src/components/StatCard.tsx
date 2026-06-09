export function StatCard({ label, value, tone = "navy" }: { label: string; value: string | number; tone?: "navy" | "green" | "gold" | "slate" }) {
  const color = {
    navy: "bg-navy-900 text-white",
    green: "bg-green-600 text-white",
    gold: "bg-amber-500 text-navy-900",
    slate: "bg-white text-navy-900"
  }[tone];

  return (
    <div className={`rounded-lg p-5 shadow-sm ${color}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm opacity-80">{label}</div>
    </div>
  );
}
