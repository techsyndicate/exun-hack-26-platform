import { useEffect, useRef, useState, type FormEvent } from "react";
import { MESSAGE_MAX_LENGTH, roomSchema } from "../../../shared/direct";
import Navbar from "../../components/Navbar";
import { formatAgo } from "../../format";
import "../styles/direct-page.css";
import { usePeers } from "./usePeers";

const DEFAULT_ROOM = "safehouse";

function Room({ room }: { room: string }) {
  const { connected, ended, self, peers, open, lines, problem, broadcast } = usePeers(room);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const log = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (lines.length > 0) log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines]);

  const post = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (broadcast(text) === 0) return setNotice("Nobody is connected yet.");
    setNotice(null);
    setDraft("");
  };

  const status = connected
    ? `Connected to the #${room} room server.`
    : ended
      ? `${ended}. Reload to rejoin here.`
      : "Connecting to the room server.";

  let hint = "The line is open. Say something.";
  if (peers.length === 0) {
    hint = `No other agent is here. Open another browser profile or device, sign in with a different account, and join #${room}.`;
  } else if (open.size === 0) {
    hint = "Another agent is here. Establishing a direct connection...";
  }

  return (
    <div className="direct-room">
      <aside className="direct-agents">
        <h3>Agents here</h3>
        <ul>
          <li>
            <span className="direct-dot is-open" />
            {self.codename} <small>you</small>
          </li>
          {peers.map((peer) => {
            const isOpen = open.has(peer.agent);
            return (
              <li key={peer.agent}>
                <span className={`direct-dot ${isOpen ? "is-open" : ""}`} />
                {peer.codename} <small>{isOpen ? "connected" : "connecting"}</small>
              </li>
            );
          })}
        </ul>
        <p className={`direct-status ${connected ? "" : "is-down"}`}>{status}</p>
      </aside>

      <div className="direct-chat">
        <ol className="direct-log" ref={log} aria-live="polite">
          {lines.length === 0 && <li className="direct-empty">{hint}</li>}
          {lines.map((line) => (
            <li key={line.id} className={line.from === self.codename ? "is-self" : ""}>
              <span className="direct-from">{line.from}</span>
              <span className="direct-text">{line.text}</span>
              <small>{formatAgo(line.time)}</small>
            </li>
          ))}
        </ol>
        <form className="direct-send" onSubmit={post}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={`Message #${room}`}
            placeholder={open.size === 0 ? "Waiting for another agent" : `Message #${room}`}
            maxLength={MESSAGE_MAX_LENGTH}
          />
          <button disabled={!draft.trim() || open.size === 0}>Send</button>
        </form>
        {(problem ?? notice) && (
          <p className="direct-error" role="alert">
            {problem ?? notice}
          </p>
        )}
      </div>
    </div>
  );
}

export function Direct() {
  const [room, setRoom] = useState(DEFAULT_ROOM);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const join = (event: FormEvent) => {
    event.preventDefault();
    const parsed = roomSchema.safeParse(name.trim().toLowerCase());
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? "That room name won't work.");
    setError(null);
    setRoom(parsed.data);
    setName("");
  };

  return (
    <div className="main">
      <div className="direct-container">
        <Navbar />
      </div>

      <div className="ledger-section">
        <p>
          Messages go straight between browsers over WebRTC. The server only introduces agents to
          each other, and nothing is stored.
        </p>
      </div>

      <div className="direct-section" id="direct">
        <h2 className="section-title">#{room}</h2>
        <form className="direct-join" onSubmit={join}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Switch room"
            aria-label="Room name"
          />
          <button>Join</button>
        </form>
        {error && (
          <p className="direct-error" role="alert">
            {error}
          </p>
        )}
        <Room key={room} room={room} />
      </div>
    </div>
  );
}
