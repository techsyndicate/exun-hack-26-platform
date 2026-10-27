import { useState, type FormEvent } from "react";

export function EnlistPage({ enlist }: { enlist: (codename: string) => Promise<void> }) {
  const [codename, setCodename] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    void enlist(codename.trim()).catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "Could not enlist."),
    );
  };
  return (
    <main className="page">
      <h1>Join the underground</h1>
      <p>
        This device creates a signing key that never leaves it. Your actions are signed with that
        key.
      </p>
      <form onSubmit={submit}>
        <label>
          Codename{" "}
          <input
            value={codename}
            onChange={(event) => setCodename(event.target.value)}
            minLength={2}
            maxLength={16}
            required
            autoFocus
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button>Enlist</button>
      </form>
    </main>
  );
}
