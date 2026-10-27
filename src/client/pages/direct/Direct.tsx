import { useState, type FormEvent } from "react";
import { MESSAGE_MAX_LENGTH, roomSchema } from "../../../shared/direct";
import { formatAgo } from "../../format";
import { usePeers } from "./usePeers";

const DEFAULT_ROOM = "safehouse";

function Room({ room }: { room: string }) {
  const { connected, self, peers, open, lines, problem, broadcast } = usePeers(room);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const post = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (broadcast(text) === 0) return setNotice("Nobody is connected yet.");
    setNotice(null);
    setDraft("");
  };

  return (
    <>
      <p>
        {connected
          ? `Connected to the #${room} room server.`
          : "Connecting to the room server."}
      </p>
      <h3>Agents here</h3>
      <ul>
        <li>
          {self.codename}, you
        </li>
        {peers.map((peer) => (
          <li key={peer.agent}>
            {peer.codename}, {open.has(peer.agent) ? "connected" : "connecting"}
          </li>
        ))}
      </ul>
      {peers.length === 0 && (
        <p>
          No other agent is connected. Open another browser profile or device, sign in with a
          different account, and join #{room}.
        </p>
      )}
      {peers.length > 0 && open.size === 0 && (
        <p>Another agent is here; establishing a direct connection...</p>
      )}
      <ol aria-live="polite">
        {lines.map((line) => (
          <li key={line.id}>
            <b>{line.from}</b>: {line.text} <small>{formatAgo(line.time)}</small>
          </li>
        ))}
      </ol>
      <form onSubmit={post}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Message #${room}`}
          maxLength={MESSAGE_MAX_LENGTH}
        />{" "}
        <button disabled={!draft.trim() || open.size === 0}>Send</button>
      </form>
      {draft.trim() && open.size === 0 && (
        <p role="status">Send is available after another agent connects.</p>
      )}
      {(problem ?? notice) && (
        <p className="error" role="alert">
          {problem ?? notice}
        </p>
      )}
    </>
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
    <>
      <h1>Direct</h1>
      <p>
        Messages go straight between browsers over WebRTC. The server only introduces agents to each
        other, and nothing is stored.
      </p>
      <form onSubmit={join}>
        <label>
          Room{" "}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={room}
          />
        </label>{" "}
        <button>Join</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section>
        <h2>#{room}</h2>
        <Room key={room} room={room} />
      </section>
    </>
  );
}
