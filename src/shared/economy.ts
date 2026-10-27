export const RESOURCES = ["credits", "alloy", "verdant"] as const;
export type Resource = (typeof RESOURCES)[number];
export type Amounts = Partial<Record<Resource, number>>;

export const STARTER_KIT: Amounts = { credits: 250, alloy: 20, verdant: 1 };

export const TRANSFER_HOLD_MINUTES = 30;

export function shortfall(held: Record<Resource, number>, cost: Amounts): Resource | null {
  return RESOURCES.find((resource) => held[resource] < (cost[resource] ?? 0)) ?? null;
}

export function amountEntries(amounts: Amounts): [Resource, number][] {
  return RESOURCES.flatMap((resource) => {
    const amount = amounts[resource];
    return amount ? [[resource, amount] as [Resource, number]] : [];
  });
}
