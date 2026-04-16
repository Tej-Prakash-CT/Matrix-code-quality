import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminApi,
  clearAdminToken,
  hasAdminToken,
  type AdminConfig,
  type SeverityFilter,
} from "@/lib/api";
import {
  Wrench,
  Sliders,
  Scale,
  ShieldAlert,
  Ban,
  LogOut,
  Save,
  Plus,
  X,
  KeyRound,
} from "lucide-react";

type Tab =
  | "tools"
  | "thresholds"
  | "weights"
  | "severity"
  | "ignored"
  | "security";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "thresholds", label: "Thresholds", icon: Sliders },
  { id: "weights", label: "Grade Weights", icon: Scale },
  { id: "severity", label: "Severity Filter", icon: ShieldAlert },
  { id: "ignored", label: "Ignored Rules", icon: Ban },
  { id: "security", label: "Security", icon: KeyRound },
];

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [draft, setDraft] = useState<AdminConfig | null>(null);
  const [tab, setTab] = useState<Tab>("tools");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAdminToken()) {
      navigate("/admin/login", { replace: true });
      return;
    }
    adminApi
      .getConfig()
      .then((cfg) => {
        setConfig(cfg);
        setDraft(cfg);
      })
      .catch((e) => {
        if (String(e.message).includes("authenticated")) {
          navigate("/admin/login", { replace: true });
          return;
        }
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const dirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(draft),
    [config, draft]
  );

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await adminApi.saveConfig(draft);
      setConfig(saved);
      setDraft(saved);
      flash("Configuration saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleLogout() {
    try {
      await adminApi.logout();
    } catch {
      /* ignore */
    }
    clearAdminToken();
    navigate("/admin/login", { replace: true });
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-destructive">
          {error || "Failed to load configuration."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Portal</h1>
          <p className="text-sm text-muted-foreground">
            Manage tool enablement, thresholds, severity policy and rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-yellow-500">Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-sm rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Saving\u2026" : "Save"}
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1 border border-border text-sm rounded-md px-3 py-1.5 hover:bg-accent"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {toast && (
        <div className="text-xs bg-green-500/10 text-green-600 border border-green-500/30 rounded-md px-3 py-2">
          {toast}
        </div>
      )}
      {error && (
        <div className="text-xs bg-destructive/10 text-destructive border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors ${
              tab === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "tools" && <ToolsPane draft={draft} setDraft={setDraft} />}
      {tab === "thresholds" && (
        <ThresholdsPane draft={draft} setDraft={setDraft} />
      )}
      {tab === "weights" && <WeightsPane draft={draft} setDraft={setDraft} />}
      {tab === "severity" && (
        <SeverityPane draft={draft} setDraft={setDraft} />
      )}
      {tab === "ignored" && <IgnoredRulesPane draft={draft} setDraft={setDraft} />}
      {tab === "security" && <SecurityPane onFlash={flash} />}
    </div>
  );
}

// ── Panes ────────────────────────────────────────────────────────────────

function ToolsPane({
  draft,
  setDraft,
}: {
  draft: AdminConfig;
  setDraft: (c: AdminConfig) => void;
}) {
  const entries = Object.entries(draft.tools);
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tools configured. Save to initialize defaults.
      </p>
    );
  }
  return (
    <div className="bg-card rounded-lg p-4 shadow-sm divide-y divide-border">
      {entries.map(([key, tool]) => (
        <div
          key={key}
          className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
        >
          <div>
            <p className="text-sm font-semibold">{tool.display_name || key}</p>
            <p className="text-xs text-muted-foreground">{tool.description}</p>
          </div>
          <button
            onClick={() =>
              setDraft({
                ...draft,
                tools: {
                  ...draft.tools,
                  [key]: { ...tool, enabled: !tool.enabled },
                },
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              tool.enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                tool.enabled ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  suffix,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-2 border border-border rounded-md px-2 py-1">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 bg-transparent text-sm outline-none"
        />
        {suffix && (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </label>
  );
}

function ThresholdsPane({
  draft,
  setDraft,
}: {
  draft: AdminConfig;
  setDraft: (c: AdminConfig) => void;
}) {
  const t = draft.thresholds;
  const set = (patch: Partial<typeof t>) =>
    setDraft({ ...draft, thresholds: { ...t, ...patch } });
  return (
    <div className="bg-card rounded-lg p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumberInput
        label="Coverage target"
        value={t.coverage_target_pct}
        onChange={(v) => set({ coverage_target_pct: v })}
        suffix="%"
      />
      <NumberInput
        label="Duplication warning"
        value={t.duplication_warning_pct}
        onChange={(v) => set({ duplication_warning_pct: v })}
        suffix="%"
      />
      <NumberInput
        label="Duplication fail"
        value={t.duplication_fail_pct}
        onChange={(v) => set({ duplication_fail_pct: v })}
        suffix="%"
      />
      <NumberInput
        label="Bugs/kLOC warning"
        value={t.bugs_per_kloc_warning}
        onChange={(v) => set({ bugs_per_kloc_warning: v })}
      />
      <NumberInput
        label="Bugs/kLOC danger"
        value={t.bugs_per_kloc_danger}
        onChange={(v) => set({ bugs_per_kloc_danger: v })}
      />
      <NumberInput
        label="Vulns/kLOC warning"
        value={t.vulns_per_kloc_warning}
        onChange={(v) => set({ vulns_per_kloc_warning: v })}
      />
      <NumberInput
        label="Vulns/kLOC danger"
        value={t.vulns_per_kloc_danger}
        onChange={(v) => set({ vulns_per_kloc_danger: v })}
      />
      <NumberInput
        label="Hotspots warning"
        step={1}
        value={t.hotspots_warning}
        onChange={(v) => set({ hotspots_warning: v })}
      />
      <NumberInput
        label="Hotspots danger"
        step={1}
        value={t.hotspots_danger}
        onChange={(v) => set({ hotspots_danger: v })}
      />
      <NumberInput
        label="Tech debt warning"
        value={t.tech_debt_ratio_warning_pct}
        onChange={(v) => set({ tech_debt_ratio_warning_pct: v })}
        suffix="%"
      />
      <NumberInput
        label="Tech debt danger"
        value={t.tech_debt_ratio_danger_pct}
        onChange={(v) => set({ tech_debt_ratio_danger_pct: v })}
        suffix="%"
      />
    </div>
  );
}

function WeightsPane({
  draft,
  setDraft,
}: {
  draft: AdminConfig;
  setDraft: (c: AdminConfig) => void;
}) {
  const w = draft.grade_weights;
  const set = (patch: Partial<typeof w>) =>
    setDraft({ ...draft, grade_weights: { ...w, ...patch } });
  const total =
    w.reliability +
    w.security +
    w.maintainability +
    w.coverage +
    w.duplication +
    w.tests;

  const rows: [keyof typeof w, string][] = [
    ["reliability", "Reliability"],
    ["security", "Security"],
    ["maintainability", "Maintainability"],
    ["coverage", "Coverage"],
    ["duplication", "Duplication"],
    ["tests", "Tests"],
  ];

  return (
    <div className="bg-card rounded-lg p-4 shadow-sm space-y-3">
      {rows.map(([key, label]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-40 text-sm">{label}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={w[key]}
            onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<typeof w>)}
            className="flex-1"
          />
          <span className="w-12 text-right text-sm font-mono">
            {w[key].toFixed(2)}
          </span>
        </div>
      ))}
      <p
        className={`text-xs ${
          Math.abs(total - 1) < 0.001 ? "text-green-500" : "text-yellow-500"
        }`}
      >
        Sum: {total.toFixed(2)}{" "}
        {Math.abs(total - 1) >= 0.001 && "(should equal 1.00)"}
      </p>
    </div>
  );
}

const SEVERITIES = ["high", "medium", "low"];

function SeverityPane({
  draft,
  setDraft,
}: {
  draft: AdminConfig;
  setDraft: (c: AdminConfig) => void;
}) {
  const s = draft.severity_filter;
  const toggleVisible = (sev: string) => {
    const next = s.min_severity.includes(sev)
      ? s.min_severity.filter((x) => x !== sev)
      : [...s.min_severity, sev];
    setDraft({ ...draft, severity_filter: { ...s, min_severity: next } });
  };
  const toggleFail = (sev: string) => {
    const next = s.fail_on.includes(sev)
      ? s.fail_on.filter((x) => x !== sev)
      : [...s.fail_on, sev];
    setDraft({ ...draft, severity_filter: { ...s, fail_on: next } });
  };
  return (
    <div className="bg-card rounded-lg p-4 shadow-sm space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">Severity levels to display</p>
        <div className="flex gap-2">
          {SEVERITIES.map((sev) => (
            <button
              key={sev}
              onClick={() => toggleVisible(sev)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors capitalize ${
                s.min_severity.includes(sev)
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Select one or more severity levels. Only findings matching selected
          levels are shown on dashboards and counted in KPIs.
        </p>
        {s.min_severity.length === 0 && (
          <p className="text-xs text-yellow-500 mt-1">
            No severities selected — all findings will be hidden.
          </p>
        )}
      </div>
      <div>
        <p className="text-sm font-medium mb-2">PR fails on severities</p>
        <div className="flex gap-3">
          {SEVERITIES.map((sev) => (
            <label
              key={sev}
              className="inline-flex items-center gap-2 text-sm capitalize"
            >
              <input
                type="checkbox"
                checked={s.fail_on.includes(sev)}
                onChange={() => toggleFail(sev)}
              />
              {sev}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function IgnoredRulesPane({
  draft,
  setDraft,
}: {
  draft: AdminConfig;
  setDraft: (c: AdminConfig) => void;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const id = input.trim();
    if (!id || draft.ignored_rules.includes(id)) return;
    setDraft({ ...draft, ignored_rules: [...draft.ignored_rules, id] });
    setInput("");
  };
  const remove = (id: string) =>
    setDraft({
      ...draft,
      ignored_rules: draft.ignored_rules.filter((r) => r !== id),
    });

  return (
    <div className="bg-card rounded-lg p-4 shadow-sm space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Rule ID, e.g. C0114"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm bg-transparent"
        />
        <button
          onClick={add}
          className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-sm rounded-md px-3 py-1.5"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      {draft.ignored_rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No rules ignored. Add a rule ID to suppress it from findings.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {draft.ignored_rules.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 bg-muted rounded-full px-2.5 py-0.5 text-xs font-mono"
            >
              {id}
              <button
                onClick={() => remove(id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${id}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SecurityPane({ onFlash }: { onFlash: (m: string) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.changePassword(username.trim(), password);
      setPassword("");
      setConfirm("");
      onFlash("Password updated — you will need to sign in again on next visit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-card rounded-lg p-4 shadow-sm max-w-md space-y-3"
    >
      <p className="text-sm font-medium">Change admin credentials</p>
      <label className="block">
        <span className="text-xs text-muted-foreground">Username</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full border border-border rounded-md px-2 py-1.5 text-sm bg-transparent"
          required
        />
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">New password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full border border-border rounded-md px-2 py-1.5 text-sm bg-transparent"
          required
        />
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">Confirm password</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full border border-border rounded-md px-2 py-1.5 text-sm bg-transparent"
          required
        />
      </label>
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-primary-foreground text-sm rounded-md px-3 py-1.5 disabled:opacity-60"
      >
        {submitting ? "Saving\u2026" : "Update password"}
      </button>
    </form>
  );
}
