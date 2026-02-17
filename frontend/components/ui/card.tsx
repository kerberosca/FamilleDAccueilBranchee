type CardVariant = "default" | "glass" | "elevated";

export function Card({
  children,
  className = "",
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
}) {
  const base = "rounded-xl p-5 transition-all duration-200";
  const variants: Record<CardVariant, string> = {
    default:
      "border border-slate-700/80 bg-slate-900/90 shadow-sm",
    glass:
      "border border-slate-600/50 bg-slate-800/40 backdrop-blur-md shadow-lg shadow-black/20",
    elevated:
      "border border-cyan-500/20 bg-slate-800/60 backdrop-blur-sm shadow-[0_0_0_1px_rgba(34,211,238,0.1),0_8px_24px_-8px_rgba(0,0,0,0.4)]",
  };
  return <section className={`${base} ${variants[variant]} ${className}`}>{children}</section>;
}
