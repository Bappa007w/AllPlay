import { notFound } from "next/navigation";
import { roomIdSchema } from "@allplay/shared";
import { RoomDashboard } from "@/features/room/room-dashboard";
import "@/features/room/room.css";

export const metadata = { title: "Room · AllPlay" };
export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!roomIdSchema.safeParse(roomId).success) notFound();
  return <RoomDashboard roomId={roomId} />;
}
