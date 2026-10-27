import { shortfall } from "../../shared/economy";
import type { Tx } from "../../shared/ledger/schema";
import type { Book } from "./book";

export function rejection(tx: Tx, book: Book, _now: number): string | null {
  const agent = book.agent(tx.agent);

  if (tx.kind === "enlist") {
    if (agent) return "This key already belongs to an agent.";
    if (tx.nonce !== 0) return "A new agent starts at nonce 0.";
    return book.codenameTaken(tx.codename) ? `The codename ${tx.codename} is taken.` : null;
  }

  if (!agent) return "Enlist before filing anything else.";
  if (tx.nonce !== agent.nonce) return "This was signed out of order. Refresh and try again.";

  if (tx.to === tx.agent) return "You can't send resources to yourself.";
  if (!book.agent(tx.to)) return "No agent holds that key.";
  const held = book.balances(tx.agent);
  const missing = shortfall(held, { [tx.resource]: tx.amount });
  return missing && `Not enough ${missing}: you have ${held[missing]}, this needs ${tx.amount}.`;
}

export function record(tx: Tx, book: Book, now: number) {
  if (tx.kind === "enlist") book.addAgent(tx.agent, tx.codename, now);
}
