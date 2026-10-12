"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Info, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Membership } from "@allplay/shared";
import { api, guestSession } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FieldErrors = { name?: string; code?: string };

export function RoomEntryForm({
  mode,
  initialCode = "",
  onJoined,
}: {
  mode: "create" | "join";
  initialCode?: string;
  onJoined?: () => void;
}) {
  const isJoin = mode === "join";
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const submitting = useRef(false);
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFeedback("");
    const nextErrors: FieldErrors = {};
    const normalizedCode = code.replace(/[\s-]/g, "").toUpperCase();
    if (isJoin && !/^[A-HJ-NP-Z2-9]{12}$/.test(normalizedCode)) {
      nextErrors.code = "Enter a 12-character room ID using A–Z (except I and O) and 2–9.";
    }
    if (name.trim().length < 2 || name.trim().length > 32) {
      nextErrors.name = "Enter a display name between 2 and 32 characters.";
    } else if (
      Array.from(name).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    ) {
      nextErrors.name = "Your display name cannot contain control characters.";
    }
    setErrors(nextErrors);
    if (nextErrors.code) codeRef.current?.focus();
    else if (nextErrors.name) nameRef.current?.focus();
    else {
      setCode(normalizedCode);
      setName(name.trim());
      submitting.current = true;
      setBusy(true);
      try {
        const session = await guestSession();
        setCurrentRoom(session.roomId);
        const fingerprint = JSON.stringify([mode, normalizedCode, name.trim()]);
        if (request.current?.fingerprint !== fingerprint)
          request.current = { fingerprint, id: crypto.randomUUID() };
        const result = await api<Membership>(isJoin ? `/rooms/${normalizedCode}/join` : "/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": session.csrfToken },
          body: JSON.stringify({ displayName: name.trim(), requestId: request.current.id }),
        });
        if (onJoined && result.room.id === initialCode) onJoined();
        else router.push(`/room/${result.room.id}`);
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : "Unable to reach AllPlay. Please retry.",
        );
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <div className="entry-card">
      <div className="entry-tabs" aria-label="Room options">
        <Link href="/create" aria-current={!isJoin ? "page" : undefined}>
          Create a room
        </Link>
        <Link href="/join" aria-current={isJoin ? "page" : undefined}>
          Join a room
        </Link>
      </div>
      <div className="entry-card-body">
        <h2>{isJoin ? "Your invitation starts here." : "A space for your sound."}</h2>
        <p className="form-intro">
          {isJoin
            ? "Enter your invitation code and display name."
            : "Choose the name your friends will see in the room."}
        </p>
        <div className="preview-banner">
          <Info size={18} aria-hidden="true" />
          <p>
            <strong>Room sessions are ready.</strong> Music and synchronized playback are not
            available yet. Rooms are temporary; local memory-mode rooms reset when the server
            restarts.
          </p>
        </div>
        <form noValidate onSubmit={handleSubmit}>
          {isJoin && (
            <div className="field">
              <label htmlFor="room-code">
                Room ID <span>Required</span>
              </label>
              <Input
                ref={codeRef}
                id="room-code"
                name="roomCode"
                className="code-input"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setFeedback("");
                  setErrors((previous) => ({ ...previous, code: "" }));
                }}
                maxLength={24}
                placeholder="ABCD-EFGH-JK23"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                required
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? "code-help code-error" : "code-help"}
              />
              <p id="code-help" className="field-help">
                12 characters. Spaces and hyphens are optional.
              </p>
              {errors.code && (
                <p id="code-error" className="field-error">
                  {errors.code}
                </p>
              )}
            </div>
          )}
          <div className="field">
            <label htmlFor="display-name">
              Display name <span>Required</span>
            </label>
            <Input
              ref={nameRef}
              id="display-name"
              name="displayName"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFeedback("");
                setErrors((previous) => ({ ...previous, name: "" }));
              }}
              maxLength={32}
              placeholder="What should we call you?"
              autoComplete="nickname"
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-help name-error" : "name-help"}
            />
            <p id="name-help" className="field-help">
              2–32 characters. A nickname is all you need.
            </p>
            {errors.name && (
              <p id="name-error" className="field-error">
                {errors.name}
              </p>
            )}
          </div>
          <Button type="submit" className="form-submit" disabled={busy}>
            {busy ? "Connecting…" : isJoin ? "Join room" : "Create room"}
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
          <div role="status" aria-live="polite" aria-atomic="true">
            {feedback && (
              <div className="form-feedback">
                <Info size={19} aria-hidden="true" />
                <p>{feedback}</p>
              </div>
            )}
          </div>
        </form>
        {currentRoom && (
          <p className="form-privacy">
            <Link href={`/room/${currentRoom}`}>Return to your current room</Link>
          </p>
        )}
        <p className="form-privacy">
          <LockKeyhole size={13} aria-hidden="true" /> No email, password or account needed.
        </p>
      </div>
    </div>
  );
}
