import { useEffect, useState } from "react";
import type { Role } from "../../shared/roles";
import { useMe } from "../me";
import "./styles/admin-page.css";
import Navbar from "../components/Navbar";

type Verification = {
  username: string;
  codename: string;
  agent: string;
  role: Role;
  vouches: number;
  joined: number | null;
  entry: { exuniteCode: number; details: string } | null;
};

function joinedOn(joined: number | null) {
  if (!joined) return "-";
  return new Date(joined).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
  });
}

function Admin() {
  const me = useMe();
  const [rows, setRows] = useState<Verification[] | null>(null);
  const [selected, setSelected] = useState<Verification | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const isAdmin = me?.role === "admin";
  const pending = rows?.filter((row) => row.role === "unverified") ?? null;

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/verifications")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load verification data.");
        setRows((await response.json()) as Verification[]);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      });
  }, [isAdmin]);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  async function verify(user: Verification) {
    setVerifying(true);
    const response = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: user.agent }),
    });
    setVerifying(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Could not verify this user.");
      setSelected(null);
      return;
    }
    setRows(
      (current) =>
        current?.map((row) =>
          row.agent === user.agent ? { ...row, role: "verified" } : row,
        ) ?? null,
    );
    setSelected(null);
    setError("");
    setMessage(`${user.codename} is now verified.`);
  }

  return (
    <div className="main-admin">
      <Navbar />
      <h1 style={{ textAlign: "center", color: "#ca852c" }}>Admin Page</h1>

      <div className="ledger-blocks">
        <h2 className="section-title">Verification requests</h2>
        {!isAdmin && <p className="admin-note">Only admins can see this.</p>}
        {error && <p className="admin-note">{error}</p>}
        {message && <p className="admin-note">{message}</p>}
        {isAdmin && !rows && !error && <p className="admin-note">Loading...</p>}
        {pending && pending.length === 0 && (
          <p className="admin-note">Nobody is waiting to be verified.</p>
        )}
        {pending && pending.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Codename</th>
                <th>Username</th>
                <th>Exunite code</th>
                <th>Details</th>
                <th>Vouches</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="admin-backdrop" onClick={() => setSelected(null)}>
          <div
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Verify ${selected.codename}`}
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
              <dt>Agent key</dt>
              <dd className="break">{selected.agent}</dd>
            </dl>
            <div className="admin-dialog-actions">
              <button
                onClick={() => void verify(selected)}
                disabled={verifying}
              >
                {verifying ? "Verifying..." : "Verify"}
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

export default Admin;
