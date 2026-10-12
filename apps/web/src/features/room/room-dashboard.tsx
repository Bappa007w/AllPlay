"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  Membership,
  RoomState,
  ServerToClientEvents,
} from "@allplay/shared";
import { Button } from "@/components/ui/button";
import { api, ApiError, guestSession } from "@/features/room-entry/api";
import { RoomEntryForm } from "@/features/room-entry/room-entry-form";

type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export function RoomDashboard({ roomId }: { roomId: string }) {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [status, setStatus] = useState("Connecting");
  const [message, setMessage] = useState("");
  const [join, setJoin] = useState(false);
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<RoomSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: RoomSocket | undefined;
    let terminal = false;
    const update = (room: RoomState) =>
      setMembership((current) =>
        current && room.revision >= current.room.revision ? { ...current, room } : current,
      );
    async function connect() {
      try {
        const session = await guestSession();
        const initial = await api<Membership>(`/rooms/${roomId}`);
        if (cancelled) return;
        setMembership(initial);
        setJoin(false);
        setMessage("");
        setEnded(false);
        socket = io({
          path: "/socket.io",
          auth: { roomId, csrfToken: session.csrfToken },
          withCredentials: true,
          autoConnect: false,
        });
        socketRef.current = socket;
        socket.on("room:state", update);
        socket.on("connect", () => {
          setStatus("Connected");
          socket?.emit("room:state", (result) => {
            if (cancelled) return;
            if (result.ok) setMembership(result.data);
            else setMessage(result.error.message);
          });
        });
        socket.on("disconnect", (reason) => {
          if (!terminal && reason !== "io client disconnect")
            setStatus("Disconnected — reconnecting");
        });
        socket.on("connect_error", (error) => {
          setStatus("Disconnected");
          setMessage(
            error.message === "ROOM_NOT_FOUND"
              ? "This room expired or the server restarted."
              : `Connection failed (${error.message}). Retry to refresh your session.`,
          );
        });
        socket.on("session:replaced", () => {
          terminal = true;
          setEnded(true);
          setStatus("Active in another tab");
          setMessage(
            "This room is now open in another tab. Close that tab and reload here to return.",
          );
        });
        socket.on("room:closed", (reason) => {
          terminal = true;
          setEnded(true);
          setStatus("Room closed");
          setMessage(reason);
        });
        socket.connect();
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.code === "NOT_A_MEMBER") {
          setJoin(true);
          setStatus("Join room");
        } else {
          setStatus("Room unavailable");
          setMessage(error instanceof Error ? error.message : "Please retry.");
        }
      }
    }
    void connect();
    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [roomId, attempt]);

  const me = membership?.room.participants.find((member) => member.id === membership.participantId);
  async function exitRoom() {
    const socket = socketRef.current;
    if (!socket?.connected || !membership || busy) return;
    const host = me?.role === "host";
    if (host && !window.confirm("Close this room for everyone? This cannot be undone.")) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await socket.timeout(5000).emitWithAck(host ? "room:close" : "room:leave", {
        requestId: crypto.randomUUID(),
        expectedRevision: membership.room.revision,
      });
      if (!result.ok) {
        setMessage(result.error.message);
        socket.emit("room:state", (latest) => {
          if (latest.ok) setMembership(latest.data);
        });
      } else {
        setEnded(true);
        setStatus(host ? "Room closed" : "You left the room");
        socket.disconnect();
      }
    } catch {
      setMessage(
        "No confirmation received. Retry connection to check the room state before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Invitation link copied.");
    } catch {
      setMessage(`Copy this invitation: ${window.location.href}`);
    }
  }
  return (
    <main id="main-content" tabIndex={-1} className="container room-main">
      <p className="eyebrow">YOUR SHARED SPACE</p>
      <h1>{ended ? status : "Your room"}</h1>
      <div className="room-toolbar">
        <p>
          Room ID: <strong className="room-code">{roomId}</strong>
        </p>
        <p role="status" aria-label="Connection status">
          {status}
        </p>
        {!ended && (
          <Button variant="outline" onClick={share}>
            Copy invitation
          </Button>
        )}
      </div>
      {message && (
        <p role="alert" className="preview-banner">
          {message}
        </p>
      )}
      {join ? (
        <RoomEntryForm
          key={`${roomId}-${attempt}`}
          mode="join"
          initialCode={roomId}
          onJoined={() => {
            setJoin(false);
            setAttempt((value) => value + 1);
          }}
        />
      ) : !ended && membership ? (
        <div className="room-grid">
          <section className="room-panel" aria-labelledby="session-title">
            <h2 id="session-title">Welcome, {me?.displayName}</h2>
            <p>
              Your role: <strong>{me?.role === "host" ? "Host" : "Participant"}</strong>
            </p>
            <p>
              Invite your people. Music, queue controls and synchronized audio will arrive in later
              phases.
            </p>
            <div className="preview-banner">Playback is not available yet.</div>
            <p className="field-help">
              Rooms last up to 24 hours and reset on server restart. Hosts have 10 minutes to
              reconnect; participant seats are reserved for 2 minutes. Only one active room per
              browser session.
            </p>
            <Button onClick={exitRoom} disabled={busy || status !== "Connected"} variant="outline">
              {busy ? "Please wait…" : me?.role === "host" ? "Close room" : "Leave room"}
            </Button>
          </section>
          <section className="room-panel" aria-labelledby="participants-title">
            <h2 id="participants-title">
              Participants ({membership.room.participants.length}/{membership.room.capacity})
            </h2>
            <ul className="room-participants">
              {membership.room.participants.map((member) => (
                <li key={member.id}>
                  <span>
                    <strong>{member.displayName}</strong>
                    {member.id === me?.id ? " (you)" : ""}
                    <small>{member.role === "host" ? "Host" : "Participant"}</small>
                  </span>
                  <span>{member.connected ? "Online" : "Reconnecting"}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
      {!ended && status !== "Connected" && !join && (
        <Button
          onClick={() => {
            setStatus("Connecting");
            setAttempt((value) => value + 1);
          }}
        >
          Retry connection
        </Button>
      )}
      <p className="room-return">
        <Link href="/">Back to AllPlay</Link>
        {ended && (
          <>
            {" "}
            · <Link href="/create">Create another room</Link>
          </>
        )}
      </p>
    </main>
  );
}
