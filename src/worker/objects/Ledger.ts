import { DurableObject } from "cloudflare:workers";
import { GENESIS_NOTE, hashBlock, type Block, type BlockBody } from "../../shared/ledger/block";
import { effectsOf } from "../../shared/ledger/effects";
import type { Submission, Tx, VerificationEntry } from "../../shared/ledger/schema";
import type { Role } from "../../shared/roles";
import { verifySignature, withinClockSkew } from "../../shared/signature";
import { Book } from "../ledger/book";
import { record, rejection } from "../ledger/rules";

type SubmitResult = { ok: true; block: Block } | { ok: false; error: string };

export class Ledger extends DurableObject<Env> {
  private readonly book: Book;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.book = new Book(ctx.storage.sql);
    void ctx.blockConcurrencyWhile(async () => {
      this.book.migrate();
      if (!this.book.head()) {
        const body: BlockBody = {
          height: 0,
          prev: "",
          time: Date.now(),
          tx: { kind: "genesis", note: GENESIS_NOTE },
          signature: "",
          effects: [],
        };
        this.book.insert({ ...body, hash: await hashBlock(body) });
      }
    });
  }

  submit(submission: Submission): Promise<SubmitResult> {
    const run = this.queue.then(() => this.process(submission));
    this.queue = run.catch(() => undefined);
    return run;
  }

  head() {
    return this.book.head();
  }

  recent(before: number | undefined, limit: number) {
    return this.book.recent(before, limit);
  }

  range(from: number, limit: number) {
    return this.book.range(from, limit);
  }

  agents() {
    return this.book
      .agents()
      .map(({ id, codename, joined, role }) => ({ id, codename, joined, role }));
  }

  agent(id: string) {
    return this.book.agent(id);
  }

  codename(id: string) {
    return this.book.agent(id)?.codename ?? null;
  }

  member(id: string) {
    const agent = this.book.agent(id);
    return agent ? { codename: agent.codename, role: agent.role } : null;
  }

  profile(id: string) {
    const agent = this.book.agent(id);
    if (!agent) return null;
    return {
      ...agent,
      balances: this.book.balances(id),
      history: this.book.byAgent(id, 20),
    };
  }

  user(username: string) {
    return this.book.user(username);
  }

  addUser(user: {
    username: string;
    passwordHash: string;
    passwordSalt: string;
    agent: string;
    privateKey: string;
    codename: string;
  }) {
    return this.book.addUser(user);
  }

  addAgent(id: string, codename: string, joined: number) {
    this.book.addAgent(id, codename, joined);
  }

  session(tokenHash: string, now: number) {
    return this.book.session(tokenHash, now);
  }

  addSession(tokenHash: string, userId: number, expiresAt: number) {
    this.book.addSession(tokenHash, userId, expiresAt);
  }

  removeSession(tokenHash: string) {
    this.book.removeSession(tokenHash);
  }
  renameUser(userId: number, newUsername: string) {
    this.book.renameUser(userId, newUsername);
  }

  renameCodename(userId: number, newCodename: string) {
    this.book.renameCodename(userId, newCodename);
  }

  setAvatar(userId: number, avatar: string | null) {
    this.book.setAvatar(userId, avatar);
  }

  setVerificationEntry(userId: number, entry: VerificationEntry) {
    this.book.setVerificationEntry(userId, entry);
  }

  setRole(agent: string, role: Role) {
    this.book.setRole(agent, role);
  }

  verifications() {
    return this.book.verifications().map((row) => ({
      username: row.username,
      codename: row.codename,
      agent: row.agent,
      role: row.role,
      vouches: row.vouches,
      joined: row.joined,
      entry: row.verification_entry
        ? (JSON.parse(row.verification_entry) as VerificationEntry)
        : null,
    }));
  }

  private async process({ tx, signature }: Submission): Promise<SubmitResult> {
    const now = Date.now();
    if (!withinClockSkew(tx.time, now)) {
      return {
        ok: false,
        error: "Your device clock is off by more than five minutes.",
      };
    }
    if (!(await verifySignature(tx.agent, tx, signature))) {
      return {
        ok: false,
        error: "The signature does not match this agent's key.",
      };
    }
    const error = rejection(tx, this.book, now);
    if (error) return { ok: false, error };

    const block = await this.seal(tx, signature, now);
    this.ctx.storage.transactionSync(() => {
      record(tx, this.book, now);
      this.book.bumpNonce(tx.agent);
      this.book.apply(block.effects);
      this.book.insert(block);
    });
    return { ok: true, block };
  }

  private async seal(tx: Tx, signature: string, now: number): Promise<Block> {
    const head = this.book.head();
    if (!head) throw new Error("Ledger has no genesis block");
    const body: BlockBody = {
      height: head.height + 1,
      prev: head.hash,
      time: now,
      tx,
      signature,
      effects: effectsOf(tx),
    };
    return { ...body, hash: await hashBlock(body) };
  }
}
