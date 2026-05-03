type AlertTone = "error" | "info";

const toneClass: Record<AlertTone, string> = {
  error: "border border-rose-300/35 bg-rose-950/45 text-rose-100",
  info: "border border-[#6f8fe2]/35 bg-[#181339]/72 text-[#ece8ff]"
};

export function Alert({ tone = "info", children }: { tone?: AlertTone; children: React.ReactNode }) {
  return <p className={`rounded-xl p-3 text-sm backdrop-blur-sm ${toneClass[tone]}`}>{children}</p>;
}
