import { canonical } from "../canonical";
import type { Resource } from "../economy";
import { sha256Hex } from "../encoding";
import { verifySignature } from "../signature";
import { effectsOf } from "./effects";
import type { Tx } from "./schema";

type GenesisTx = { readonly kind: "genesis"; readonly note: string };

export type Delta = {
  readonly agent: string;
  readonly resource: Resource;
  readonly amount: number;
};

export type BlockBody = {
  readonly height: number;
  readonly prev: string;
  readonly time: number;
  readonly tx: Tx | GenesisTx;
  readonly signature: string;
  readonly effects: readonly Delta[];
};

export type Block = BlockBody & { readonly hash: string };

export const GENESIS_NOTE =
  "Filed by EXUN Underground. Nothing recorded here belongs to the government.";

export function hashBlock(body: BlockBody): Promise<string> {
  return sha256Hex(canonical(body));
}

export type Checkpoint = { readonly height: number; readonly hash: string };
export type ChainCheck =
  | { ok: true; head: Checkpoint }
  | { ok: false; height: number; reason: string };

function structural(block: Block, index: number): string | null {
  if (block.height !== index) return "its height is out of sequence";
  if (index === 0) {
    const { tx } = block;
    const genuine =
      tx.kind === "genesis" &&
      tx.note === GENESIS_NOTE &&
      block.effects.length === 0 &&
      !block.prev;
    return genuine ? null : "the chain does not start at the genesis block";
  }
  if (block.tx.kind === "genesis") return "a second genesis block appears mid-chain";
  return canonical(block.effects) === canonical(effectsOf(block.tx))
    ? null
    : "its effects don't match what was signed";
}

export async function verifyChain(
  ascending: readonly Block[],
  expected: readonly Checkpoint[],
): Promise<ChainCheck> {
  if (ascending.length === 0) return { ok: false, height: 0, reason: "the chain is empty" };
  const checks = await Promise.all(
    ascending.map(async ({ hash, ...body }) => ({
      sealed: (await hashBlock(body)) === hash,
      signed:
        body.tx.kind === "genesis" ||
        (await verifySignature(body.tx.agent, body.tx, body.signature)),
    })),
  );
  let prev = "";
  for (const [i, block] of ascending.entries()) {
    const fail = (reason: string): ChainCheck => ({ ok: false, height: block.height, reason });
    const problem = structural(block, i);
    if (problem) return fail(problem);
    if (block.prev !== prev) return fail("it links to the wrong block");
    if (!checks[i]?.sealed) return fail("its contents were changed");
    if (!checks[i]?.signed) return fail("its signature does not match the agent");
    prev = block.hash;
  }
  for (const point of expected) {
    if (ascending[point.height]?.hash !== point.hash) {
      return {
        ok: false,
        height: point.height,
        reason: "it differs from the block you verified before",
      };
    }
  }
  const tip = ascending.at(-1);
  return tip
    ? { ok: true, head: { height: tip.height, hash: tip.hash } }
    : { ok: false, height: 0, reason: "the chain is empty" };
}
