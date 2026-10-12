import type { Metadata } from "next";
import { RoomEntryPage } from "@/features/room-entry/room-entry-page";

export const metadata: Metadata = {
  title: "Create a room — AllPlay",
  description: "Create a temporary AllPlay room without an account.",
};
export default function CreateRoomPage() {
  return <RoomEntryPage mode="create" />;
}
