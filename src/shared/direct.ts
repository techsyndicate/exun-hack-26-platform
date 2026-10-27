import { z } from "zod";
import { agentIdSchema, signatureSchema } from "./ids";

export const ROOM_CAPACITY = 8;
export const MESSAGE_MAX_LENGTH = 2000;
export const REPLACED_CODE = 4002;

export const roomSchema = z
  .string()
  .regex(/^[a-z0-9-]{2,24}$/, "Use 2 to 24 lowercase letters, numbers or dashes");

const joinSchema = z.strictObject({
  kind: z.literal("join"),
  agent: agentIdSchema,
  room: roomSchema,
  nonce: z.uuid(),
});

const payloadSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("offer"), sdp: z.string().max(20_000) }),
  z.strictObject({ type: z.literal("answer"), sdp: z.string().max(20_000) }),
  z.strictObject({
    type: z.literal("candidate"),
    candidate: z.string().max(2_000),
    sdpMid: z.string().max(64).nullable(),
    sdpMLineIndex: z.number().int().min(0).max(64).nullable(),
  }),
]);

const signalSchema = z.strictObject({
  kind: z.literal("signal"),
  room: roomSchema,
  from: agentIdSchema,
  to: agentIdSchema,
  time: z.number().int().positive(),
  payload: payloadSchema,
});

export const directFrameSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("join"),
    join: joinSchema,
    signature: signatureSchema,
  }),
  z.strictObject({
    type: z.literal("signal"),
    signal: signalSchema,
    signature: signatureSchema,
  }),
]);

export type Join = z.infer<typeof joinSchema>;
export type Signal = z.infer<typeof signalSchema>;
export type Payload = Signal["payload"];
export type DirectFrame = z.infer<typeof directFrameSchema>;
// @ts-ignore
export type Peer = { agent: string; codename: string };

export type RoomFrame =
  | { type: "challenge"; nonce: string }
  | { type: "peers"; peers: Peer[] }
  | { type: "joined"; peer: Peer }
  | { type: "left"; agent: string }
  | { type: "signal"; signal: Signal; signature: string }
  | { type: "error"; error: string };

export const isRoomFrame = (data: unknown): data is RoomFrame =>
  typeof data === "object" && data !== null && "type" in data && typeof data.type === "string";
