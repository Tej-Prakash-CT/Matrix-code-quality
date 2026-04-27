import { Languages } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "ja", label: "日本語" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground">
      <Languages size={16} />
      <div className="flex gap-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setLang(opt.value)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              lang === opt.value
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-accent hover:text-accent-foreground"
            }`}
            aria-pressed={lang === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
