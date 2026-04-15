import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, User } from "lucide-react";
import { adminApi, setAdminToken } from "@/lib/api";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token } = await adminApi.login(username.trim(), password);
      setAdminToken(token);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-card rounded-lg shadow-md p-6 space-y-4 border border-border"
      >
        <div className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-2">
            <Lock size={22} />
          </div>
          <h1 className="text-xl font-bold">Admin Portal</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sign in to manage tools, thresholds and rules.
          </p>
        </div>

        <label className="block">
          <span className="text-xs text-muted-foreground">Username</span>
          <div className="mt-1 flex items-center gap-2 border border-border rounded-md px-2 py-1.5">
            <User size={14} className="text-muted-foreground" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm"
              placeholder="admin"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">Password</span>
          <div className="mt-1 flex items-center gap-2 border border-border rounded-md px-2 py-1.5">
            <Lock size={14} className="text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="flex-1 bg-transparent outline-none text-sm"
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
            />
          </div>
        </label>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? "Signing in\u2026" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
