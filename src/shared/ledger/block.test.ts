import { describe, expect, test } from "bun:test";
import { canonical } from "../canonical";
import { toBase64Url, utf8 } from "../encoding";
import { SIGNING_ALGORITHM } from "../signature";
import { GENESIS_NOTE, hashBlock, verifyChain, type Block, type BlockBody } from "./block";
import { effectsOf } from "./effects";
import type { Tx } from "./schema";

async function agent() {
  const pair = (await crypto.subtle.generateKey(SIGNING_ALGORITHM, false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const id = toBase64Url(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  const sign = async (tx: Tx) =>
    toBase64Url(
      new Uint8Array(
        await crypto.subtle.sign(SIGNING_ALGORITHM, pair.privateKey, utf8(canonical(tx))),
      ),
    );
  return { id, sign };
}

async function seal(body: BlockBody): Promise<Block> {
  return { ...body, hash: await hashBlock(body) };
}

async function chain() {
  const mega = await agent();
  const genesis = await seal({
    height: 0,
    prev: "",
    time: 1,
    tx: { kind: "genesis", note: GENESIS_NOTE },
    signature: "",
    effects: [],
  });
  const txs: Tx[] = [
    { kind: "enlist", agent: mega.id, nonce: 0, time: 2, codename: "Mega" },
    {
      kind: "transfer",
      agent: mega.id,
      nonce: 1,
      time: 3,
      to: (await agent()).id,
      resource: "credits",
      amount: 40,
    },
  ];
  const blocks = [genesis];
  for (const tx of txs) {
    const prev = blocks.at(-1);
    if (!prev) throw new Error("empty chain");
    blocks.push(
      await seal({
        height: blocks.length,
        prev: prev.hash,
        time: tx.time,
        tx,
        signature: await mega.sign(tx),
        effects: effectsOf(tx),
      }),
    );
  }
  return blocks;
}

async function relink(blocks: Block[]) {
  const out: Block[] = [];
  for (const { hash: _, ...body } of blocks)
    out.push(await seal({ ...body, prev: out.at(-1)?.hash ?? "" }));
  return out;
}

describe("verifyChain", () => {
  test("accepts an honest chain", async () => {
    const blocks = await chain();
    expect(await verifyChain(blocks, [])).toEqual({
      ok: true,
      head: { height: 2, hash: blocks[2]?.hash ?? "" },
    });
  });

  test("rejects rehashed blocks whose effects were inflated", async () => {
    const blocks = await chain();
    const transfer = blocks[2];
    if (!transfer) throw new Error("missing block");
    blocks[2] = {
      ...transfer,
      effects: [
        { agent: transfer.effects[0]?.agent ?? "", resource: "credits", amount: 1_000_000 },
      ],
    };
    const result = await verifyChain(await relink(blocks), []);
    expect(result).toMatchObject({ ok: false, height: 2 });
  });

  test("rejects a second genesis block and gaps in height", async () => {
    const blocks = await chain();
    const extra = await relink([...blocks, { ...blocks[0], height: 3 } as Block]);
    expect(await verifyChain(extra, [])).toMatchObject({ ok: false, height: 3 });
    const gap = await relink([blocks[0], { ...blocks[1], height: 5 }] as Block[]);
    expect(await verifyChain(gap, [])).toMatchObject({ ok: false, height: 5 });
  });

  test("rejects a chain that drops blocks behind a remembered checkpoint", async () => {
    const blocks = await chain();
    const checkpoint = { height: 2, hash: blocks[2]?.hash ?? "" };
    expect(await verifyChain(blocks.slice(0, 2), [checkpoint])).toMatchObject({
      ok: false,
      height: 2,
    });
  });

  test("rejects an empty chain", async () => {
    expect(await verifyChain([], [])).toMatchObject({ ok: false });
  });
});
