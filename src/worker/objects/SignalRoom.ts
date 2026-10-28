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
    const problem =
      parsed.data.type === "join"
        ? await this.join(socket, parsed.data)
        : this.relay(socket, parsed.data);
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
    const codename = await ledger(this.env).codename(join.agent);
    if (!codename) return "Enlist before joining a room.";

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
