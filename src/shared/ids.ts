import { z } from "zod";

export const agentIdSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Not a valid agent key");
export const signatureSchema = z.string().regex(/^[A-Za-z0-9_-]{86}$/, "Not a valid signature");
