import { useContext } from "react";
import { realtimeSocketContext } from "@/context/notification-context";

export function userealtimeSocket() {
  const context = useContext(realtimeSocketContext);
  if (!context) throw new Error("userealtimeSocket must be used within a realtimeSocketProvider");

  return context;
}
