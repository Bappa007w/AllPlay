import type { Metadata } from "next";
import { RoomEntryPage } from "@/features/room-entry/room-entry-page";

export const metadata: Metadata = {
  title: "Join a room — AllPlay",
  description: "Join an AllPlay room with an invitation code and display name.",
};
export default function JoinRoomPage() {
  return <RoomEntryPage mode="join" />;
}
