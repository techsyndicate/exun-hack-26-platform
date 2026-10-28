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
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    agent TEXT NOT NULL UNIQUE,
    private_key TEXT NOT NULL,
    codename TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS wipes (
    name TEXT PRIMARY KEY
  );
`;

const WIPE = "2026-10-29-2";

export class Book {
  constructor(private readonly sql: SqlStorage) {}

  migrate() {
    this.sql.exec(SCHEMA);
    const columns = this.sql.exec<{ name: string }>("PRAGMA table_info(users)").toArray();
    if (!columns.some((column) => column.name === "avatar")) {
      this.sql.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
    }
    this.wipe();
  }

  private wipe() {
    const done = this.sql.exec("SELECT name FROM wipes WHERE name = ?", WIPE).toArray();
    if (done.length > 0) return;

    for (const table of ["sessions", "users", "balances", "agents", "blocks"]) {
      this.sql.exec(`DELETE FROM ${table}`);
    }
    this.sql.exec("INSERT INTO wipes (name) VALUES (?)", WIPE);
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
    return this.sql.exec<AgentRow>("SELECT * FROM agents WHERE id = ?", id).toArray()[0] ?? null;
  }

  agents(): AgentRow[] {
    return this.sql.exec<AgentRow>("SELECT * FROM agents ORDER BY joined").toArray();
  }

  codenameTaken(codename: string): boolean {
    return this.sql.exec("SELECT 1 FROM agents WHERE codename = ?", codename).toArray().length > 0;
  }

  balances(agent: string): Record<Resource, number> {
    const rows = this.sql
      .exec<{
        resource: Resource;
        amount: number;
      }>("SELECT resource, amount FROM balances WHERE agent = ?", agent)
      .toArray();
    const held = Object.fromEntries(RESOURCES.map((resource) => [resource, 0])) as Record<
      Resource,
      number
    >;
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

  user(username: string) {
    return (
      this.sql
        .exec<{
          id: number;
          username: string;
          password_hash: string;
          password_salt: string;
          agent: string;
          private_key: string;
          codename: string;
        }>("SELECT * FROM users WHERE username = ?", username)
        .toArray()[0] ?? null
    );
  }

  addUser(user: {
    username: string;
    passwordHash: string;
    passwordSalt: string;
    agent: string;
    privateKey: string;
    codename: string;
  }) {
    this.sql.exec(
      "INSERT INTO users (username, password_hash, password_salt, agent, private_key, codename) VALUES (?, ?, ?, ?, ?, ?)",
      user.username,
      user.passwordHash,
      user.passwordSalt,
      user.agent,
      user.privateKey,
      user.codename,
    );
    return this.user(user.username);
  }

  session(tokenHash: string, now: number) {
    return (
      this.sql
        .exec<{
          id: number;
          username: string;
          agent: string;
          private_key: string;
          codename: string;
          avatar: string | null;
        }>(
          `SELECT users.id, users.username, users.agent, users.private_key, users.codename, users.avatar
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
          tokenHash,
          now,
        )
        .toArray()[0] ?? null
    );
  }

  addSession(tokenHash: string, userId: number, expiresAt: number) {
    this.sql.exec(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      tokenHash,
      userId,
      expiresAt,
    );
  }

  removeSession(tokenHash: string) {
    this.sql.exec("DELETE FROM sessions WHERE token_hash = ?", tokenHash);
  }

  renameUser(userId: number, newUsername: string) {
    this.sql.exec("UPDATE users SET username = ? WHERE id = ?", newUsername, userId);
  }

  setAvatar(userId: number, avatar: string | null) {
    this.sql.exec("UPDATE users SET avatar = ? WHERE id = ?", avatar, userId);
  }

  userById(userId: number) {
    return (
      this.sql
        .exec<{
          id: number;
          username: string;
          password_hash: string;
          password_salt: string;
          agent: string;
          private_key: string;
          codename: string;
        }>("SELECT * FROM users WHERE id = ?", userId)
        .toArray()[0] ?? null
    );
  }
}
