import { useEffect, useState, type FormEvent } from "react";

type CurrentUser = {
  username: string;
  agent: string;
  codename: string;
};

type ErrorResponse = {
  error?: string;
};

export function AccountPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });

        const data = (await response.json()) as
          | (CurrentUser & { user?: never })
          | { user: null };

        if (!response.ok || ("user" in data && data.user === null)) {
          setMessage("You are not signed in.");
          return;
        }

        setUser(data as CurrentUser);
      } catch {
        setMessage("Could not load your account.");
      } finally {
        setLoading(false);
      }
    }

    void loadUser();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch("/api/auth/username", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        newUsername,
      }),
    });

    const data = (await response.json()) as ErrorResponse & {
      username?: string;
    };

    if (!response.ok) {
      setMessage(data.error ?? "Could not update your username.");
      return;
    }

    setUser((current) =>
      current
        ? {
            ...current,
            username: data.username ?? newUsername,
          }
        : current,
    );

    setNewUsername("");
    setMessage("Username updated successfully.");
  }

  if (loading) {
    return <p>Loading account...</p>;
  }

  if (!user) {
    return <p>{message || "You are not signed in."}</p>;
  }

  return (
    <main className="page">
      <h1>Hello {user.username}!</h1>

      <p>Username: {user.username}</p>
      <p>Codename: {user.codename}</p>
      <p>Agent key: {user.agent}</p>

      <h2>Change username</h2>

      <form onSubmit={handleSubmit}>
        <label>
          New username{" "}
          <input
            value={newUsername}
            onChange={(event) => setNewUsername(event.target.value)}
            minLength={3}
            maxLength={32}
            required
          />
        </label>

        <button type="submit">Update username</button>
      </form>

      {message && <p role="status">{message}</p>}
    </main>
  );
}
