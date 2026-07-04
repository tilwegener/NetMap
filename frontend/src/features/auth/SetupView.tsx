import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";

export function SetupView({ onSubmit }: { onSubmit: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await onSubmit(username, password);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-surface">
      <form className="auth-card" onSubmit={submit}>
        <div className="form-icon">
          <UserPlus size={22} aria-hidden="true" />
        </div>
        <h1>Create SuperAdmin</h1>
        <p>No default credentials exist. Create the first administrator to continue.</p>
        <label>
          Username
          <input
            autoComplete="username"
            autoFocus
            minLength={3}
            maxLength={80}
            pattern="[A-Za-z0-9_.-]+"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          Password
          <span className="auth-field-hint">At least 12 characters</span>
          <input
            autoComplete="new-password"
            minLength={12}
            maxLength={256}
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {formError && <div className="form-error">{formError}</div>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create admin"}
        </button>
      </form>
    </section>
  );
}
