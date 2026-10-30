import "./styles/home-page.css";
import Navbar from "../components/Navbar";
import { useState, type FormEvent } from "react";
import { useMe } from "../me";

export function HomePage() {
  const me = useMe();
  const [exuniteCode, setExuniteCode] = useState(
    me?.verificationEntry?.exuniteCode.toString() ?? "",
  );
  const [details, setDetails] = useState(me?.verificationEntry?.details ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/auth/verification-entry", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exuniteCode: Number(exuniteCode), details }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Error submitting your details");
      return;
    }
    setMessage("Your details are sent for verification by the admin.");
  }

  if (me?.role !== "unverified") {
    return (
      <div className="container">
        <Navbar />
      </div>
    );
  }

  return (
    <div className="main">
      <div className="container">
        <Navbar />
      </div>
      <div className="home-section">
        <h1 style={{ textAlign: "center" }}>Welcome to the Los Rebeldes</h1>
        <p style={{ width: "70%", textAlign: "center", margin: "2vh auto" }}>
          Los Rebeldes is a place where agents can come together to stand
          against the nuxeLand government.
        </p>

        <form className="home-form" onSubmit={(event) => void submit(event)}>
          <label>Your Exunite code:</label>
          <input
            type="number"
            min={0}
            placeholder="Enter your code"
            value={exuniteCode}
            onChange={(event) => setExuniteCode(event.target.value)}
            required
          />
          <label>Your Details:</label>
          <textarea
            placeholder="Enter your details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            required
          />
          <button type="submit" disabled={saving}>
            {saving ? "Submitting..." : "Submit"}
          </button>
          {message && <p style={{ marginTop: "2vh" }}>{message}</p>}
          {error && (
            <p style={{ marginTop: "2vh" }} role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
