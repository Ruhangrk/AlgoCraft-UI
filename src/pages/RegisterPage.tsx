import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { ApiError } from "@/types/api";
import { Button, ErrorBanner, Field, PageShell, Panel, TextInput } from "@/components/ui";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await register(username.trim(), password);
      navigate("/workbooks", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell title="Create account" subtitle="JWT-backed access to your AlgoCraft workbooks.">
      <div className="mx-auto max-w-md">
        <Panel>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Field label="Username">
              <TextInput
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </Field>
            <ErrorBanner message={error} />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating…" : "Register"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
            Already registered?{" "}
            <Link className="font-medium text-[var(--color-accent)]" to="/login">
              Sign in
            </Link>
          </p>
        </Panel>
      </div>
    </PageShell>
  );
}
