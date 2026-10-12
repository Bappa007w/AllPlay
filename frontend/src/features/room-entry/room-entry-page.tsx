import Link from "next/link";
import { ArrowLeft, AudioLines, Headphones, Link2, ShieldCheck } from "lucide-react";
import { RoomEntryForm } from "./room-entry-form";

export function RoomEntryPage({ mode }: { mode: "create" | "join" }) {
  const isJoin = mode === "join";
  return (
    <main id="main-content" tabIndex={-1} className="entry-main container">
      <Link href="/" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to AllPlay
      </Link>
      <div className="entry-layout">
        <div className="entry-copy">
          <p className="eyebrow">
            {isJoin ? "GOOD COMPANY IS A ROOM AWAY" : "EVERY GREAT SESSION STARTS SOMEWHERE"}
          </p>
          <h1>
            {isJoin ? (
              <>
                Find your people.
                <br />
                <span>Join their rhythm.</span>
              </>
            ) : (
              <>
                Your people.
                <br />
                Your music.
                <br />
                <span>Your room.</span>
              </>
            )}
          </h1>
          <p>
            {isJoin
              ? "A room ID, a name, and a shared love of music. That's the idea behind listening together on AllPlay."
              : "Bring everyone into the same moment. A shared room puts you in charge of the soundtrack."}
          </p>
          <ul className="entry-perks">
            <li>
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>{isJoin ? "Come as you are" : "You're the host"}</strong>
                <span>
                  {isJoin
                    ? "No registration. Just your display name."
                    : "Invite your friends and close the room. Officer management is coming later."}
                </span>
              </div>
            </li>
            <li>
              <Link2 aria-hidden="true" />
              <div>
                <strong>
                  {isJoin ? "One invite, one shared space" : "Make it a shared moment"}
                </strong>
                <span>
                  {isJoin
                    ? "Use the room ID shared by your host."
                    : "Invite your friends with a link or room ID."}
                </span>
              </div>
            </li>
            <li>
              <Headphones aria-hidden="true" />
              <div>
                <strong>Your device, your volume</strong>
                <span>Local audio controls will arrive with music playback.</span>
              </div>
            </li>
          </ul>
          <div className="entry-signoff">
            <AudioLines aria-hidden="true" />
            <span>One Beat. Every Device.</span>
          </div>
        </div>
        <RoomEntryForm mode={mode} />
      </div>
    </main>
  );
}
