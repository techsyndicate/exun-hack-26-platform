import { RESOURCES, type Resource } from "../../shared/economy";
import type { Block, Delta } from "../../shared/ledger/block";
import type { VerificationEntry } from "../../shared/ledger/schema";
import type { Role } from "../../shared/roles";

type AgentRow = {
  id: string;
  codename: string;
  joined: number;
  nonce: number;
  role: Role;
};

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
    nonce INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'unverified'
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
    codename TEXT NOT NULL,
    verification_entry TEXT,
    vouches INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS wipes (
    name TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS vouches (
    voucher TEXT NOT NULL,
    target TEXT NOT NULL,
    time INTEGER NOT NULL,
    PRIMARY KEY (voucher, target)
  );
`;

const WIPE = "2026-10-29-2";

export class Book {
  constructor(private readonly sql: SqlStorage) {}

  migrate() {
    this.sql.exec(SCHEMA);
    this.addColumn("users", "avatar", "TEXT");
    this.addColumn("users", "verification_entry", "TEXT");
    this.addColumn("users", "vouches", "INTEGER NOT NULL DEFAULT 0");
    this.addColumn("agents", "role", "TEXT NOT NULL DEFAULT 'unverified'");
    this.wipe();
  }

  private addColumn(table: string, column: string, definition: string) {
    const columns = this.sql.exec<{ name: string }>(`PRAGMA table_info(${table})`).toArray();
    if (!columns.some((existing) => existing.name === column)) {
      this.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  private wipe() {
    const done = this.sql.exec("SELECT name FROM wipes WHERE name = ?", WIPE).toArray();
    if (done.length > 0) return;

    for (const table of ["sessions", "users", "balances", "agents", "blocks", "vouches"]) {
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
          verification_entry: string | null;
          vouches: number;
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
          verification_entry: string | null;
          vouches: number;
          role: Role;
        }>(
          `SELECT users.id, users.username, users.agent, users.private_key, users.codename, users.avatar,
            users.verification_entry, users.vouches,
            COALESCE(agents.role, 'unverified') AS role
       FROM sessions JOIN users ON users.id = sessions.user_id
       LEFT JOIN agents ON agents.id = users.agent
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

  renameCodename(userId: number, newCodename: string) {
    this.sql.exec("UPDATE users SET codename = ? WHERE id = ?", newCodename, userId);
    this.sql.exec(
      "UPDATE agents SET codename = ? WHERE id = (SELECT agent FROM users WHERE id = ?)",
      newCodename,
      userId,
    );
  }

  setAvatar(userId: number, avatar: string | null) {
    this.sql.exec("UPDATE users SET avatar = ? WHERE id = ?", avatar, userId);
  }

  setVerificationEntry(userId: number, entry: VerificationEntry) {
    this.sql.exec(
      "UPDATE users SET verification_entry = ? WHERE id = ?",
      JSON.stringify(entry),
      userId,
    );
  }

  setRole(agent: string, role: Role) {
    this.sql.exec("UPDATE agents SET role = ? WHERE id = ?", role, agent);
  }

  verifications() {
    return this.sql
      .exec<{
        username: string;
        codename: string;
        agent: string;
        verification_entry: string | null;
        vouches: number;
        role: Role;
        joined: number | null;
      }>(
        `SELECT users.username, users.codename, users.agent, users.verification_entry, users.vouches,
          COALESCE(agents.role, 'unverified') AS role, agents.joined
       FROM users LEFT JOIN agents ON agents.id = users.agent
       ORDER BY agents.joined DESC`,
      )
      .toArray();
  }

  unvouched(voucher: string) {
    return this.sql
      .exec<{
        username: string;
        codename: string;
        agent: string;
        verification_entry: string | null;
        vouches: number;
        joined: number;
        vouched: number;
      }>(
        `SELECT users.username, users.codename, users.agent, users.verification_entry, users.vouches,
          agents.joined,
          EXISTS (SELECT 1 FROM vouches WHERE voucher = ?1 AND target = users.agent) AS vouched
       FROM users JOIN agents ON agents.id = users.agent
       WHERE agents.role = 'unverified' AND users.agent != ?1
       ORDER BY agents.joined DESC`,
        voucher,
      )
      .toArray();
  }

  hasVouched(voucher: string, target: string) {
    return (
      this.sql
        .exec("SELECT 1 FROM vouches WHERE voucher = ? AND target = ?", voucher, target)
        .toArray().length > 0
    );
  }

  addVouch(voucher: string, target: string, time: number) {
    this.sql.exec(
      "INSERT INTO vouches (voucher, target, time) VALUES (?, ?, ?)",
      voucher,
      target,
      time,
    );
    this.sql.exec("UPDATE users SET vouches = vouches + 1 WHERE agent = ?", target);
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
          verification_entry: string | null;
          vouches: number;
        }>("SELECT * FROM users WHERE id = ?", userId)
        .toArray()[0] ?? null
    );
  }
}
