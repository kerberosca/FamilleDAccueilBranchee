type AlertTone = "error" | "info";

const toneClass: Record<AlertTone, string> = {
  error: "bg-rose-900/50 text-rose-100",
  info: "bg-slate-800 text-slate-100"
};

export function Alert({ tone = "info", children }: { tone?: AlertTone; children: React.ReactNode }) {
  return <p className={`rounded-md p-3 text-sm ${toneClass[tone]}`}>{children}</p>;
}
