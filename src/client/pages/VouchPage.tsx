import { useEffect, useState } from "react";
import { useMe } from "../me";
import "./styles/vouch-page.css";
import Navbar from "../components/Navbar";

type Candidate = {
  username: string;
  codename: string;
  agent: string;
  vouches: number;
  joined: number;
  vouched: boolean;
  entry: { exuniteCode: number; details: string } | null;
};

function joinedOn(joined: number) {
  return new Date(joined).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
  });
}

function VouchPage() {
  const me = useMe();
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [vouching, setVouching] = useState<string | null>(null);
  const isVerified = me?.role === "verified" || me?.role === "admin";

  useEffect(() => {
    if (!isVerified) return;
    fetch("/api/vouch/pending")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the list.");
        setRows((await response.json()) as Candidate[]);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      });
  }, [isVerified]);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  async function vouch(user: Candidate) {
    setVouching(user.agent);
    const response = await fetch("/api/vouch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: user.agent }),
    });
    setVouching(null);
    setSelected(null);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setMessage("");
      setError(body?.error ?? "Could not vouch for this user.");
      return;
    }
    setRows(
      (current) =>
        current?.map((row) =>
          row.agent === user.agent
            ? { ...row, vouched: true, vouches: row.vouches + 1 }
            : row,
        ) ?? null,
    );
    setError("");
    setMessage(`You vouched for ${user.codename}.`);
  }

  function vouchButton(row: Candidate) {
    return (
      <button
        className="vouch-button"
        disabled={row.vouched || vouching === row.agent}
        onClick={(event) => {
          event.stopPropagation();
          void vouch(row);
        }}
      >
        {row.vouched ? "Vouched" : vouching === row.agent ? "..." : "Vouch"}
      </button>
    );
  }

  return (
    <div className="main-vouch">
      <Navbar />
      <div className="vouch-content">
        <h1>Vouch Page</h1>
        <p>You can vouch for other users on this page.</p>
      </div>

      {!isVerified && (
        <p className="admin-note">Only verified agents can see this.</p>
      )}
      {error && <p className="admin-note">{error}</p>}
      {message && <p className="vouch-message">{message}</p>}
      {isVerified && !rows && !error && (
        <p className="admin-note">Loading...</p>
      )}
      {rows && rows.length === 0 && (
        <p className="admin-note">Nobody is waiting to be verified.</p>
      )}

      {rows && rows.length > 0 && (
        <div className="ledger-blocks">
          <table>
            <thead>
              <tr>
                <th>Codename</th>
                <th>Username</th>
                <th>Exunite code</th>
                <th>Details</th>
                <th>Vouches</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.agent}
                  className="admin-row"
                  tabIndex={0}
                  onClick={() => setSelected(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setSelected(row);
                  }}
                >
                  <td>{row.codename}</td>
                  <td className="break">{row.username}</td>
                  <td>{row.entry?.exuniteCode ?? "-"}</td>
                  <td className="break">
                    {row.entry?.details ?? "Not submitted"}
                  </td>
                  <td>{row.vouches}</td>
                  <td>{joinedOn(row.joined)}</td>
                  <td>{vouchButton(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="admin-backdrop" onClick={() => setSelected(null)}>
          <div
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Vouch for ${selected.codename}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{selected.codename}</h3>
            <dl>
              <dt>Username</dt>
              <dd>{selected.username}</dd>
              <dt>Exunite code</dt>
              <dd>{selected.entry?.exuniteCode ?? "-"}</dd>
              <dt>Details</dt>
              <dd>{selected.entry?.details ?? "Not submitted"}</dd>
              <dt>Vouches</dt>
              <dd>{selected.vouches}</dd>
              <dt>Joined</dt>
              <dd>{joinedOn(selected.joined)}</dd>
            </dl>
            <div className="admin-dialog-actions">
              <button
                onClick={() => void vouch(selected)}
                disabled={selected.vouched || vouching === selected.agent}
              >
                {selected.vouched ? "Vouched" : "Vouch"}
              </button>
              <button className="secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VouchPage;
