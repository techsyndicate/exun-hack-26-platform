import { useCallback, useEffect, useRef, useState } from "react";
import {
  MESSAGE_MAX_LENGTH,
  isRoomFrame,
  type Join,
  type Payload,
  type Peer,
  type RoomFrame,
  type Signal,
} from "../../../shared/direct";
import { verifySignature } from "../../../shared/signature";
import { directSocket } from "../../api";
import { useAgent } from "../../identity/agent";
import { sign } from "../../identity/keystore";
import { useLiveSocket } from "../../live";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];

type Link = {
  peer: Peer;
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  pending: RTCIceCandidateInit[];
  queue: Promise<void>;
};

export type Line = { id: number; from: string; text: string; time: number };

export function usePeers(room: string) {
  const { keys, profile } = useAgent();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [lines, setLines] = useState<Line[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const links = useRef(new Map<string, Link>());
  const roster = useRef(new Map<string, Peer>());
  const nextLine = useRef(0);
  const inbox = useRef(Promise.resolve());
  const outbox = useRef(Promise.resolve());

  const setRoster = useCallback(
    (update: (current: Map<string, Peer>) => void) => {
      update(roster.current);
      setPeers([...roster.current.values()]);
    },
    [],
  );

  const addLine = useCallback((from: string, text: string) => {
    setLines((current) => [
      ...current,
      { id: nextLine.current++, from, text, time: Date.now() },
    ]);
  }, []);

  const setChannelOpen = useCallback((agent: string, isOpen: boolean) => {
    setOpen((current) => {
      const next = new Set(current);
      if (isOpen) next.add(agent);
      else next.delete(agent);
      return next;
    });
  }, []);

  const shouldInitiate = useCallback(
    (agent: string) => keys.id < agent,
    [keys.id],
  );

  const unlink = useCallback(
    (agent: string) => {
      links.current.get(agent)?.pc.close();
      links.current.delete(agent);
      setChannelOpen(agent, false);
    },
    [setChannelOpen],
  );

  const drop = useCallback(
    (agent: string) => {
      unlink(agent);
      setRoster((current) => current.delete(agent));
    },
    [unlink, setRoster],
  );

  const { connected, ended, send } = useLiveSocket(directSocket(room), {
    onMessage: (data) => {
      if (!isRoomFrame(data)) return;
      inbox.current = inbox.current
        .then(() => handle(data))
        .catch(() => undefined);
    },
  });

  const signal = (to: string, payload: Payload) => {
    const message: Signal = {
      kind: "signal",
      room,
      from: keys.id,
      to,
      time: Date.now(),
      payload,
    };
    outbox.current = outbox.current
      .then(async () => {
        send({
          type: "signal",
          signal: message,
          signature: await sign(keys, message),
        });
      })
      .catch(() => undefined);
    return outbox.current;
  };

  const isCurrent = (link: Link) => links.current.get(link.peer.agent) === link;

  const relink = (link: Link) => {
    if (!isCurrent(link)) return;
    unlink(link.peer.agent);
    if (shouldInitiate(link.peer.agent)) connect(link.peer, true);
  };

  const attach = (link: Link, channel: RTCDataChannel) => {
    link.channel = channel;
    channel.addEventListener("open", () => {
      if (isCurrent(link)) setChannelOpen(link.peer.agent, true);
    });
    channel.addEventListener("close", () => {
      if (isCurrent(link)) setChannelOpen(link.peer.agent, false);
    });

    channel.addEventListener("message", (event) => {
      if (
        typeof event.data !== "string" ||
        event.data.length > MESSAGE_MAX_LENGTH
      )
        return;
      addLine(link.peer.codename, event.data);
    });
  };

  const connect = (peer: Peer, initiator: boolean) => {
    unlink(peer.agent);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const link: Link = {
      peer,
      pc,
      channel: null,
      pending: [],
      queue: Promise.resolve(),
    };
    links.current.set(peer.agent, link);
    pc.addEventListener("icecandidate", ({ candidate }) => {
      if (!candidate) return;
      void signal(peer.agent, {
        type: "candidate",
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      });
    });
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed") relink(link);
    });
    if (initiator) {
      attach(link, pc.createDataChannel("chat"));
      link.queue = pc.createOffer().then(async (offer) => {
        await pc.setLocalDescription(offer);
        await signal(peer.agent, { type: "offer", sdp: offer.sdp ?? "" });
      });
    } else {
      pc.addEventListener("datachannel", (event) =>
        attach(link, event.channel),
      );
    }
    return link;
  };

  const accept = async (link: Link, payload: Payload) => {
    const { pc } = link;
    if (payload.type === "candidate") {
      const { type: _type, ...candidate } = payload;
      if (pc.remoteDescription) await pc.addIceCandidate(candidate);
      else link.pending.push(candidate);
      return;
    }
    await pc.setRemoteDescription({ type: payload.type, sdp: payload.sdp });
    await Promise.all(
      link.pending.splice(0).map((candidate) => pc.addIceCandidate(candidate)),
    );
    if (payload.type === "offer") {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await signal(link.peer.agent, { type: "answer", sdp: answer.sdp ?? "" });
    }
  };

  const receive = async ({
    signal: message,
    signature,
  }: Extract<RoomFrame, { type: "signal" }>) => {
    if (message.to !== keys.id || message.room !== room) return;
    if (!(await verifySignature(message.from, message, signature))) return;
    const known = links.current.get(message.from);
    const peer = known?.peer ?? roster.current.get(message.from);
    if (!peer) return;
    const link =
      message.payload.type === "offer" ? connect(peer, false) : known;
    if (!link) return;
    link.queue = link.queue
      .then(() => accept(link, message.payload))
      .catch(() => relink(link));
  };

  async function handle(frame: RoomFrame) {
    switch (frame.type) {
      case "challenge": {
        for (const agent of links.current.keys()) unlink(agent);
        const join: Join = {
          kind: "join",
          agent: keys.id,
          room,
          nonce: frame.nonce,
        };
        send({ type: "join", join, signature: await sign(keys, join) });
        return;
      }
      case "peers": {
        const present = new Set(frame.peers.map((peer) => peer.agent));
        for (const agent of roster.current.keys()) {
          if (!present.has(agent)) drop(agent);
        }
        setRoster((current) => {
          for (const peer of frame.peers) current.set(peer.agent, peer);
        });
        for (const peer of frame.peers) {
          if (shouldInitiate(peer.agent) && !links.current.has(peer.agent)) {
            connect(peer, true);
          }
        }
        return;
      }
      case "joined":
        setRoster((current) => current.set(frame.peer.agent, frame.peer));
        if (
          shouldInitiate(frame.peer.agent) &&
          !links.current.has(frame.peer.agent)
        ) {
          connect(frame.peer, true);
        }
        return;
      case "left":
        drop(frame.agent);
        return;
      case "signal":
        await receive(frame);
        return;
      case "error":
        setProblem(frame.error);
        return;
    }
  }

  useEffect(() => {
    const current = links.current;
    return () => {
      for (const link of current.values()) link.pc.close();
      current.clear();
    };
  }, []);

  const broadcast = (text: string) => {
    let delivered = 0;
    for (const { channel } of links.current.values()) {
      if (channel?.readyState !== "open") continue;
      channel.send(text);
      delivered++;
    }
    if (delivered > 0) addLine(profile.codename, text);
    return delivered;
  };

  return {
    connected,
    ended,
    self: { agent: keys.id, codename: profile.codename },
    peers,
    open,
    lines,
    problem,
    broadcast,
  };
}
