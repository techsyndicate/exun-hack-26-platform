import { DurableObject } from "cloudflare:workers";
import {
  GENESIS_NOTE,
  hashBlock,
  type Block,
  type BlockBody,
} from "../../shared/ledger/block";
import { effectsOf } from "../../shared/ledger/effects";
import type { Submission, Tx } from "../../shared/ledger/schema";
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
      .map(({ id, codename, joined }) => ({ id, codename, joined }));
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
