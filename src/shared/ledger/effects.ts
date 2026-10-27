import { STARTER_KIT, amountEntries } from "../economy";
import type { Delta } from "./block";
import type { Tx } from "./schema";

export function effectsOf(tx: Tx): Delta[] {
  switch (tx.kind) {
    case "enlist":
      return amountEntries(STARTER_KIT).map(([resource, amount]) => ({
        agent: tx.agent,
        resource,
        amount,
      }));
    case "transfer":
      return [
        { agent: tx.agent, resource: tx.resource, amount: -tx.amount },
        { agent: tx.to, resource: tx.resource, amount: tx.amount },
      ];
  }
}
