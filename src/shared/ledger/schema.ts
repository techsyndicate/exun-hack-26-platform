import { z } from "zod";
import { RESOURCES } from "../economy";
import { agentIdSchema, signatureSchema } from "../ids";

const codenameSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z][A-Za-z0-9 -]{1,15}$/,
    "Use 2 to 16 letters, numbers, spaces or dashes, starting with a letter",
  );

export const verificationEntrySchema = z.strictObject({
  exuniteCode: z.number().int().min(0),
  details: z.string().trim().min(1).max(2_000),
});

export type VerificationEntry = z.infer<typeof verificationEntrySchema>;

const base = {
  agent: agentIdSchema,
  nonce: z.number().int().min(0),
  time: z.number().int().positive(),
};

const txSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("enlist"), ...base, codename: codenameSchema }),
  z.strictObject({
    kind: z.literal("transfer"),
    ...base,
    to: agentIdSchema,
    resource: z.enum(RESOURCES),
    amount: z.number().int().positive().max(1_000_000),
  }),
]);

export const submissionSchema = z.strictObject({ tx: txSchema, signature: signatureSchema });

export type Tx = z.infer<typeof txSchema>;
export type Submission = z.infer<typeof submissionSchema>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type TxDraft = DistributiveOmit<Exclude<Tx, { kind: "enlist" }>, "agent" | "nonce" | "time">;
