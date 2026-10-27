import { useState, type FormEvent } from "react";

type Props = {
  signup: (input: { username: string; password: string; codename: string }) => Promise<void>;
  signin: (username: string, password: string) => Promise<void>;
};

export function AuthPage({ signup, signin }: Props) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setMessage("");
    try {
      if (mode === "signup") {
        await signup({
          username: String(values.get("username")),
          password: String(values.get("password")),
          codename: String(values.get("codename")),
        });
      } else {
        await signin(String(values.get("username")), String(values.get("password")));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    }
  }

  return (
    <main className="page">
      <h1>{mode === "signup" ? "Sign up" : "Sign in"}</h1>
      <form onSubmit={submit}>
        <label>Username <input name="username" minLength={3} maxLength={32} required /></label>
        <label>Password <input name="password" type="password" minLength={8} required /></label>
        {mode === "signup" && (
          <label>Codename <input name="codename" minLength={2} maxLength={16} required /></label>
        )}
        {message && <p role="alert">{message}</p>}
        <button>{mode === "signup" ? "Create account" : "Sign in"}</button>
      </form>
      <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
        {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
      </button>
    </main>
  );
}
