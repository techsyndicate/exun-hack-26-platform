import { RESOURCES, type Resource } from "../../shared/economy";
import type { Block, Delta } from "../../shared/ledger/block";

type AgentRow = { id: string; codename: string; joined: number; nonce: number };

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS blocks (
    height INTEGER PRIMARY KEY,
    hash TEXT NOT NULL UNIQUE,
    agent TEXT,
    counterparty TEXT,
    body TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS blocks_by_agent ON blocks (agent, height);
  CREATE INDEX IF NOT EXISTS blocks_by_counterparty ON blocks (counterparty, height);
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    codename TEXT NOT NULL UNIQUE COLLATE NOCASE,
    joined INTEGER NOT NULL,
    nonce INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS balances (
    agent TEXT NOT NULL,
    resource TEXT NOT NULL,
    amount INTEGER NOT NULL,
    PRIMARY KEY (agent, resource)
  );
`;

export class Book {
  constructor(private readonly sql: SqlStorage) {}

  migrate() {
    this.sql.exec(SCHEMA);
  }

  head(): { height: number; hash: string } | null {
    return (
      this.sql
        .exec<{
          height: number;
          hash: string;
        }>("SELECT height, hash FROM blocks ORDER BY height DESC LIMIT 1")
        .toArray()[0] ?? null
    );
  }

  recent(before: number | undefined, limit: number): Block[] {
    return this.sql
      .exec<{ body: string }>(
        "SELECT body FROM blocks WHERE height < ? ORDER BY height DESC LIMIT ?",
        before ?? Number.MAX_SAFE_INTEGER,
        limit,
      )
      .toArray()
      .map((row) => JSON.parse(row.body) as Block);
  }

  range(from: number, limit: number): Block[] {
    return this.sql
      .exec<{ body: string }>(
        "SELECT body FROM blocks WHERE height >= ? ORDER BY height LIMIT ?",
        from,
        limit,
      )
      .toArray()
      .map((row) => JSON.parse(row.body) as Block);
  }

  byAgent(agent: string, limit: number): Block[] {
    return this.sql
      .exec<{ body: string }>(
        "SELECT body FROM blocks WHERE agent = ?1 OR counterparty = ?1 ORDER BY height DESC LIMIT ?2",
        agent,
        limit,
      )
      .toArray()
      .map((row) => JSON.parse(row.body) as Block);
  }

  agent(id: string): AgentRow | null {
    return (
      this.sql
        .exec<AgentRow>("SELECT * FROM agents WHERE id = ?", id)
        .toArray()[0] ?? null
    );
  }

  agents(): AgentRow[] {
    return this.sql
      .exec<AgentRow>("SELECT * FROM agents ORDER BY joined")
      .toArray();
  }

  codenameTaken(codename: string): boolean {
    return (
      this.sql
        .exec("SELECT 1 FROM agents WHERE codename = ?", codename)
        .toArray().length > 0
    );
  }

  balances(agent: string): Record<Resource, number> {
    const rows = this.sql
      .exec<{
        resource: Resource;
        amount: number;
      }>("SELECT resource, amount FROM balances WHERE agent = ?", agent)
      .toArray();
    const held = Object.fromEntries(
      RESOURCES.map((resource) => [resource, 0]),
    ) as Record<Resource, number>;
    for (const row of rows) held[row.resource] = row.amount;
    return held;
  }

  addAgent(id: string, codename: string, joined: number) {
    this.sql.exec(
      "INSERT INTO agents (id, codename, joined, nonce) VALUES (?, ?, ?, 0)",
      id,
      codename,
      joined,
    );
  }

  bumpNonce(agent: string) {
    this.sql.exec("UPDATE agents SET nonce = nonce + 1 WHERE id = ?", agent);
  }

  apply(effects: readonly Delta[]) {
    for (const { agent, resource, amount } of effects) {
      this.sql.exec(
        `INSERT INTO balances (agent, resource, amount) VALUES (?1, ?2, ?3)
         ON CONFLICT DO UPDATE SET amount = amount + ?3`,
        agent,
        resource,
        amount,
      );
    }
  }

  insert(block: Block) {
    const { tx } = block;
    this.sql.exec(
      "INSERT INTO blocks (height, hash, agent, counterparty, body) VALUES (?, ?, ?, ?, ?)",
      block.height,
      block.hash,
      tx.kind === "genesis" ? null : tx.agent,
      tx.kind === "transfer" ? tx.to : null,
      JSON.stringify(block),
    );
  }
}
