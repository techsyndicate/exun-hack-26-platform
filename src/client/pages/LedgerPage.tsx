import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  verifyChain,
  type Block,
  type ChainCheck,
} from "../../shared/ledger/block";
import { RESOURCES, type Resource } from "../../shared/economy";
import { useAgent } from "../identity/agent";
import "./styles/ledger-page.css";
import Navbar from "../components/Navbar";

type Agent = { id: string; codename: string };
const json = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load the ledger.");
  return (await response.json()) as T;
};

export function LedgerPage() {
  const { profile, submit, refresh } = useAgent();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [to, setTo] = useState("");
  const [resource, setResource] = useState<Resource>("credits");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<ChainCheck | null>(null);

  const load = useCallback(async () => {
    const [nextAgents, nextBlocks] = await Promise.all([
      json<Agent[]>("/api/agents"),
      json<Block[]>("/api/ledger/blocks?limit=25"),
    ]);
    setAgents(nextAgents);
    setBlocks(nextBlocks);
  }, []);
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error ? error.message : "Could not load the ledger.",
        );
      });
  }, [load]);

  async function send(event: FormEvent) {
    event.preventDefault();
    try {
      await submit({ kind: "transfer", to, resource, amount: Number(amount) });
      setMessage(`Sent ${amount} ${resource}.`);
      setAmount("");
      await Promise.all([refresh(), load()]);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not send resources.",
      );
    }
  }

  async function verify() {
    setChecking(true);
    try {
      const head = await json<{ height: number; hash: string }>(
        "/api/ledger/head",
      );
      const pages = await Promise.all(
        Array.from(
          { length: Math.ceil((head.height + 1) / 1000) },
          (_, index) =>
            json<Block[]>(`/api/ledger/range?from=${index * 1000}&limit=1000`),
        ),
      );
      const result = await verifyChain(pages.flat().slice(0, head.height + 1), [
        head,
      ]);
      setCheck(result);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not verify the chain.",
      );
    } finally {
      setChecking(false);
    }
  }

  const others = agents.filter((agent) => agent.id !== profile.id);
  const value = Number(amount);
  const valid =
    Boolean(to) &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= profile.balances[resource];

  return (
    <div className="main">
      <div className="ledger-container">
        <Navbar />
      </div>

      <div className="ledger-section">
        <p>
          Ledger is a place where all transactions are recorded and verified.
          Every transaction is signed by the agent who made it and linked to the
          block before it. All the transactions are completely encrypted using
          the agent's signing key, so only the agent can read them. Using
          algorithms like sha-256, the ledger can be verified to ensure that no
          one has tampered with it.
        </p>
      </div>

      <div className="ledger-section-2">
        <div
          className="balance"
          style={{ position: "relative", top: "-1vh", right: "-27.5vw" }}
        >
          <h2 style={{ textAlign: "end", marginBottom: "-1vh" }}>Balance</h2>
          <p>
            {RESOURCES.map((item) => `${item}: ${profile.balances[item]}`).join(
              ", ",
            )}
          </p>
        </div>
        <div className="send-resources">
          <h2 className="section-title">Send resources</h2>
          {others.length === 0 ? (
            <p>No other agents have enlisted yet.</p>
          ) : (
            <form className="send-resources-form" onSubmit={send}>
              <div className="meow">
                <label>To </label>
                <select
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    Pick an agent
                  </option>
                  {others.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.codename}
                    </option>
                  ))}
                </select>
              </div>
              <label>
                Amount{" "}
                <input
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value.replace(/\D/g, ""))
                  }
                  inputMode="numeric"
                  required
                />
              </label>

              <div className="">
                <label>Resource </label>
                <div className="resource-selector">
                  <div
                    className={`resource-selection ${
                      resource === "credits" ? "selected" : ""
                    }`}
                    onClick={() => setResource("credits")}
                  >
                    Credits
                  </div>
                  <div
                    className={`resource-selection ${
                      resource === "alloy" ? "selected" : ""
                    }`}
                    onClick={() => setResource("alloy")}
                  >
                    Alloy
                  </div>
                  <div
                    className={`resource-selection ${
                      resource === "verdant" ? "selected" : ""
                    }`}
                    onClick={() => setResource("verdant")}
                  >
                    Verdant
                  </div>
                </div>
              </div>
              <button disabled={!valid}>Sign and send</button>
            </form>
          )}
          {message && <p role="status">{message}</p>}
        </div>
      </div>

      <div className="balances">
        <h2 className="section-title" style={{ marginBottom: "-1vh" }}>
          Verify the chain
        </h2>
        <p>
          Download every block and check its hash, signature, links, and effects
          in this browser.
        </p>
        <button onClick={() => void verify()} disabled={checking}>
          {checking ? "Checking" : "Verify"}
        </button>
        {check?.ok && (
          <p role="status">All {check.head.height + 1} blocks check out.</p>
        )}
        {check && !check.ok && (
          <p role="alert">
            Block {check.height} fails because {check.reason}.
          </p>
        )}
      </div>
      <div>
        <h2>Blocks</h2>
        <table>
          <thead>
            <tr>
              <th>Height</th>
              <th>Kind</th>
              <th>Agent</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => (
              <tr key={block.hash}>
                <td>{block.height}</td>
                <td>{block.tx.kind}</td>
                <td className="break">
                  {block.tx.kind === "genesis" ? "-" : block.tx.agent}
                </td>
                <td className="break">{block.hash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
