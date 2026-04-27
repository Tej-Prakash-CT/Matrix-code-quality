import { useEffect, useRef, useState } from "react";
import { Download, FileText, FileType2, Loader2, ChevronDown } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  buildDashboardHtml,
  buildPrHtml,
  downloadHtml,
  fetchDashboardData,
  openPdfWindow,
  reportFilename,
  writePdfToWindow,
} from "@/lib/report";
import { api, type ScanDetailOut } from "@/lib/api";

type ReportSource =
  | { kind: "dashboard" }
  | { kind: "pr"; prNumber: string; prefetched?: ScanDetailOut };

interface Props {
  source: ReportSource;
  /** Optional compact rendering for in-page use (e.g. PR detail header). */
  variant?: "sidebar" | "compact";
}

const REPORT_LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "ja", label: "日本語" },
];

export function DownloadReportButton({ source, variant = "sidebar" }: Props) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "html" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Local-only language for the generated report. Defaults to the dashboard
  // language but is intentionally NOT wired to setLang, so picking a report
  // language here doesn't switch the dashboard's UI language.
  const [reportLang, setReportLang] = useState<Lang>(lang);
  const ref = useRef<HTMLDivElement>(null);

  // When the menu opens, sync the default to the current dashboard language
  // so a user who just switched dashboard locale sees that as the default.
  useEffect(() => {
    if (open) setReportLang(lang);
  }, [open, lang]);

  // Close menu on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function buildHtml(): Promise<{ html: string; filename: string }> {
    if (source.kind === "dashboard") {
      const data = await fetchDashboardData();
      return {
        html: buildDashboardHtml(data, reportLang),
        filename: reportFilename("dashboard", reportLang),
      };
    }
    // Per-PR report: fetch the PR detail and the dashboard context in
    // parallel so the report has the same TOC + benchmark sections as
    // the dashboard-level report, then the PR's full per-tool detail.
    const [pr, dashboard] = await Promise.all([
      source.prefetched
        ? Promise.resolve(source.prefetched)
        : api.getScan(source.prNumber),
      fetchDashboardData(),
    ]);
    return {
      html: buildPrHtml({ pr, dashboard }, reportLang),
      filename: reportFilename(`pr-${source.prNumber}`, reportLang),
    };
  }

  async function handle(format: "pdf" | "html") {
    setError(null);
    // window.open() must run synchronously inside the click event so the
    // browser treats it as user-initiated. Async work happens after.
    let win: Window | null = null;
    if (format === "pdf") {
      win = openPdfWindow();
      if (!win) {
        setError(
          "Popup blocked — allow popups for this site in your browser, then try again.",
        );
        return;
      }
    }
    setBusy(format);
    try {
      const { html, filename } = await buildHtml();
      if (format === "html") {
        downloadHtml(html, filename);
      } else if (win) {
        writePdfToWindow(win, html, filename);
      }
      setOpen(false);
    } catch (e) {
      if (win) win.close();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const triggerClass =
    variant === "sidebar"
      ? `flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          open
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`
      : `inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors ${
          open ? "bg-accent" : ""
        }`;

  const menuClass =
    variant === "sidebar"
      ? "absolute left-2 right-2 bottom-full mb-1 z-30 rounded-md border border-border bg-card shadow-lg overflow-hidden"
      : "absolute right-0 mt-1 z-30 w-44 rounded-md border border-border bg-card shadow-lg overflow-hidden";

  return (
    <div className={`relative ${variant === "compact" ? "inline-block" : ""}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        disabled={busy !== null}
      >
        {busy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
        <span className="flex-1 text-left">
          {busy ? t("download.generating") : t("download.report")}
        </span>
        <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <div className={menuClass} role="menu">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-xs text-muted-foreground mb-1.5">
              {t("download.reportLanguage")}
            </div>
            <div className="flex gap-1">
              {REPORT_LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReportLang(opt.value)}
                  disabled={busy !== null}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                    reportLang === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border hover:bg-accent hover:text-accent-foreground"
                  }`}
                  aria-pressed={reportLang === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handle("pdf")}
            disabled={busy !== null}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <FileType2 size={14} />
            {t("download.pdf")}
          </button>
          <button
            type="button"
            onClick={() => handle("html")}
            disabled={busy !== null}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 border-t border-border"
          >
            <FileText size={14} />
            {t("download.html")}
          </button>
        </div>
      )}
      {error && (
        <p className="mt-1 px-2 text-xs text-destructive">
          {t("download.failed")}: {error}
        </p>
      )}
    </div>
  );
}
