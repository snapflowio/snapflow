import { useContext } from "react";
import { NotificationSocketContext } from "@/context/notification-context";

export function useNotificationSocket() {
  const context = useContext(NotificationSocketContext);
  if (!context)
    throw new Error(
      "useNotificationSocket must be used within a NotificationSocketProvider",
    );

  return context;
}
