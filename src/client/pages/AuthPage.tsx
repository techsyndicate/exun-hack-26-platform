import { useState, type FormEvent } from "react";
import "./styles/auth-page.css";

type Props = {
  signup: (input: {
    username: string;
    password: string;
    codename: string;
  }) => Promise<void>;
  signin: (username: string, password: string) => Promise<void>;
};

export function AuthPage({ signup, signin }: Props) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  function switchTo(next: "signup" | "signin") {
    setMode(next);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setMessage("");
    setBusy(true);
    try {
      if (isSignup) {
        await signup({
          username: String(values.get("username")),
          password: String(values.get("password")),
          codename: String(values.get("codename")),
        });
      } else {
        await signin(
          String(values.get("username")),
          String(values.get("password")),
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  let buttonText = isSignup ? "Create account" : "Sign in";
  if (busy) buttonText = isSignup ? "Creating account..." : "Signing in...";

  return (
    <div className="main">
      <div className="auth-banner" />

      <main className="auth">
        <div className="auth-tabs">
          <button
            type="button"
            className={isSignup ? "selected" : ""}
            onClick={() => switchTo("signup")}
          >
            Sign up
          </button>
          <button
            type="button"
            className={isSignup ? "" : "selected"}
            onClick={() => switchTo("signin")}
          >
            Sign in
          </button>
        </div>

        <p className="auth-intro">
          {isSignup
            ? "Enter a username and a codename, you will get 250 creds, 1 verdant, and 20 alloys for the blockchain, and your personal agent key."
            : "Login, and start exploring the platform."}
        </p>

        <form className="auth-form" onSubmit={submit}>
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_\-]+"
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              required
            />
            {isSignup && <small>At least 8 characters</small>}
          </label>

          {isSignup && (
            <label>
              Codename
              <input
                name="codename"
                minLength={2}
                maxLength={16}
                pattern="[A-Za-z][A-Za-z0-9 \-]*"
                title="Start with a letter. Letters, numbers, spaces and - only"
                required
              />
              <small>What other agents see. 2 to 16 characters.</small>
            </label>
          )}

          {message && (
            <p className="auth-error" role="alert">
              {message}
            </p>
          )}

          <button type="submit" disabled={busy}>
            {buttonText}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => switchTo(isSignup ? "signin" : "signup")}
          >
            {isSignup ? "Sign in" : "Sign up"}
          </button>
        </p>
      </main>
    </div>
  );
}
