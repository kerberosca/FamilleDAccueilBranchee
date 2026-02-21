"use client";

const MIN_LENGTH = 8;

export type PasswordRules = {
  length: boolean;
  uppercase: boolean;
  digit: boolean;
  special: boolean;
};

export function getPasswordRules(password: string, minLength = MIN_LENGTH): PasswordRules {
  return {
    length: password.length >= minLength,
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };
}

export type PasswordStrengthLevel = "weak" | "medium" | "strong";

export function getPasswordStrength(password: string, minLength = MIN_LENGTH): PasswordStrengthLevel {
  if (password.length < minLength) return "weak";
  const rules = getPasswordRules(password, minLength);
  const count = [rules.length, rules.uppercase, rules.digit, rules.special].filter(Boolean).length;
  if (count >= 4) return "strong";
  if (count >= 2) return "medium";
  return "weak";
}

const strengthLabel: Record<PasswordStrengthLevel, string> = {
  weak: "Faible",
  medium: "Moyen",
  strong: "Fort"
};

const strengthClass: Record<PasswordStrengthLevel, string> = {
  weak: "text-rose-400",
  medium: "text-amber-400",
  strong: "text-emerald-400"
};

const barClass: Record<PasswordStrengthLevel, string> = {
  weak: "bg-rose-500 w-1/3",
  medium: "bg-amber-500 w-2/3",
  strong: "bg-emerald-500 w-full"
};

type Props = {
  password: string;
  minLength?: number;
  showBar?: boolean;
};

export function PasswordStrength({ password, minLength = MIN_LENGTH, showBar = true }: Props) {
  const rules = getPasswordRules(password, minLength);
  const strength = getPasswordStrength(password, minLength);

  const ruleItems: { label: string; ok: boolean }[] = [
    { label: `Au moins ${minLength} caractères`, ok: rules.length },
    { label: "Une majuscule", ok: rules.uppercase },
    { label: "Un chiffre", ok: rules.digit },
    { label: "Un caractère spécial", ok: rules.special }
  ];

  return (
    <div className="space-y-1.5 text-sm">
      {password.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            {showBar && (
              <div className="h-1.5 flex-1 max-w-[80px] rounded-full bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${barClass[strength]}`}
                />
              </div>
            )}
            <span className={strengthClass[strength]}>{strengthLabel[strength]}</span>
          </div>
          <ul className="text-slate-400 space-y-0.5">
            {ruleItems.map(({ label, ok }) => (
              <li key={label} className={ok ? "text-emerald-500/90" : ""}>
                {ok ? "✓ " : "○ "}
                {label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
