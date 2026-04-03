/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ReactNode, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { RealtimeContext } from "@/context/realtime-context";
import { env } from "@/env";
import { useAuth } from "@/hooks/use-auth";

export function RealtimeProvider(props: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizationId, setOrganizationId] = useState<string | null>(() =>
    localStorage.getItem("organization")
  );

  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const handleStorageChange = () => {
      const newOrgId = localStorage.getItem("organization");
      setOrganizationId(newOrgId);
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!user || !organizationId) {
      socket?.disconnect();
      setSocket(null);
      return;
    }

    socket?.disconnect();

    const newSocket = io(env.VITE_API_URL.replace("/api", ""), {
      path: "/api/realtime",
      autoConnect: true,
      transports: ["websocket"],
      withCredentials: true,
      query: {
        organizationId,
      },
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, organizationId]);

  return (
    <RealtimeContext.Provider value={{ realtimeSocket: socket }}>
      {props.children}
    </RealtimeContext.Provider>
  );
}
