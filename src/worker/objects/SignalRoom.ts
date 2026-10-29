import { DurableObject } from "cloudflare:workers";
import {
  REPLACED_CODE,
  ROOM_CAPACITY,
  directFrameSchema,
  type DirectFrame,
  type Peer,
  type RoomFrame,
} from "../../shared/direct";
import { verifySignature, withinClockSkew } from "../../shared/signature";
import { MAX_SOCKETS, parseFrame } from "../frames";
import { ledger } from "../stubs";

type Attachment = { room: string; nonce: string; peer: Peer | null };

const frame = (value: RoomFrame) => JSON.stringify(value);

export class SignalRoom extends DurableObject<Env> {
  override async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) {
      return new Response("This room is crowded. Try again shortly.", {
        status: 503,
      });
    }
    const room = new URL(request.url).pathname.split("/").at(-2) ?? "";
    const nonce = crypto.randomUUID();
    const [client, server] = Object.values(new WebSocketPair()) as [
      WebSocket,
      WebSocket,
    ];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      room,
      nonce,
      peer: null,
    } satisfies Attachment);
    server.send(frame({ type: "challenge", nonce }));
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer,
  ) {
    const parsed = directFrameSchema.safeParse(parseFrame(message));
    if (!parsed.success)
      return socket.send(
        frame({ type: "error", error: "That message was malformed." }),
      );
    let problem: string | null;
    if (parsed.data.type === "join") problem = await this.join(socket, parsed.data);
    else if (parsed.data.type === "signal") problem = this.relay(socket, parsed.data);
    else problem = this.pass(socket, parsed.data);
    if (problem) socket.send(frame({ type: "error", error: problem }));
  }

  override webSocketClose(socket: WebSocket) {
    if (socket.readyState === WebSocket.CLOSING) socket.close();
    const { peer } = socket.deserializeAttachment() as Attachment;
    if (
      peer &&
      !this.members().some((member) => member.peer.agent === peer.agent)
    ) {
      this.broadcast({ type: "left", agent: peer.agent });
    }
  }

  private async join(
    socket: WebSocket,
    { join, signature }: Extract<DirectFrame, { type: "join" }>,
  ) {
    const attachment = socket.deserializeAttachment() as Attachment;
    if (attachment.peer) return "You already joined this room.";
    if (join.room !== attachment.room || join.nonce !== attachment.nonce)
      return "That join was for another room.";
    if (!(await verifySignature(join.agent, join, signature)))
      return "The signature doesn't match your key.";
    const enlisted = await ledger(this.env).member(join.agent);
    if (!enlisted) return "Enlist before joining a room.";
    if (enlisted.role === "unverified") return "Your account hasn't been verified yet.";
    const { codename } = enlisted;

    const others = this.members().filter(
      (member) => member.peer.agent !== join.agent,
    );
    if (others.length >= ROOM_CAPACITY) return "This room is full.";
    const replaced = this.members().filter(
      (member) => member.peer.agent === join.agent,
    );
    for (const member of replaced)
      member.socket.close(REPLACED_CODE, "Joined from another tab");
    if (replaced.length > 0)
      this.broadcast({ type: "left", agent: join.agent });

    const peer = { agent: join.agent, codename };
    socket.serializeAttachment({ ...attachment, peer } satisfies Attachment);
    this.broadcastRosters();
    return null;
  }

  private relay(
    socket: WebSocket,
    { signal, signature }: Extract<DirectFrame, { type: "signal" }>,
  ) {
    const { room, peer } = socket.deserializeAttachment() as Attachment;
    if (!peer) return "Join the room first.";
    if (signal.from !== peer.agent || signal.room !== room)
      return "That signal wasn't yours to send.";
    if (!withinClockSkew(signal.time, Date.now()))
      return "Your device clock is off by more than five minutes.";
    const targets = this.members().filter(
      (member) => member.peer.agent === signal.to,
    );
    if (targets.length === 0) return "That agent has left the room.";
    for (const target of targets)
      target.socket.send(frame({ type: "signal", signal, signature }));
    return null;
  }

  private pass(
    socket: WebSocket,
    { to, text }: Extract<DirectFrame, { type: "relay" }>,
  ) {
    const { peer } = socket.deserializeAttachment() as Attachment;
    if (!peer) return "Join the room first.";
    const message = frame({ type: "relayed", from: peer.agent, text });
    for (const member of this.members()) {
      if (member.peer.agent !== peer.agent && to.includes(member.peer.agent)) {
        member.socket.send(message);
      }
    }
    return null;
  }

  private members() {
    return this.ctx.getWebSockets().flatMap((socket) => {
      const { peer } = socket.deserializeAttachment() as Attachment;
      return peer && socket.readyState === WebSocket.OPEN
        ? [{ socket, peer }]
        : [];
    });
  }

  private broadcast(value: RoomFrame) {
    const text = frame(value);
    for (const member of this.members()) member.socket.send(text);
  }

  private broadcastRosters() {
    for (const member of this.members()) {
      member.socket.send(
        frame({
          type: "peers",
          peers: this.members()
            .filter((current) => current.peer.agent !== member.peer.agent)
            .map((current) => current.peer),
        }),
      );
    }
  }
}
