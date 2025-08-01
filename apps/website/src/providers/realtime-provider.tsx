"use client";

import { ReactNode, useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { io } from "socket.io-client";
import { RealtimeContext } from "@/context/realtime-context";
import { env } from "@/env";

type Props = {
  children: ReactNode;
};

export function RealtimeProvider(props: Props) {
  const { user, getAccessTokenSilently } = useAuth0();
  const RealtimeSocketRef = useRef(
    io(env.NEXT_PUBLIC_API_URL.replace("/api", ""), {
      path: "/api/realtime/",
      autoConnect: false,
      transports: ["websocket", "webtransport"],
    })
  );

  useEffect(() => {
    const connectToSocket = async () => {
      const socket = RealtimeSocketRef.current;
      if (user) {
        const token = await getAccessTokenSilently();
        socket.auth = { token };
        socket.connect();
      }

      return () => {
        socket.disconnect();
      };
    };

    connectToSocket();
  }, [user]);

  return (
    <RealtimeContext.Provider value={{ realtimeSocket: RealtimeSocketRef.current }}>
      {props.children}
    </RealtimeContext.Provider>
  );
}
