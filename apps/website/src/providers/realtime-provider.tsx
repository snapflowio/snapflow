import { ReactNode, useEffect, useRef } from "react";
import { useLogto } from "@logto/react";
import { io } from "socket.io-client";
import { RealtimeContext } from "@/context/realtime-context";
import { useApi } from "@/hooks/use-api";

type Props = {
  children: ReactNode;
};

export function RealtimeSocketProvider(props: Props) {
  const { user } = useApi();
  const { getIdToken } = useLogto();
  const RealtimeSocketRef = useRef(
    io(window.location.origin, {
      path: "/api/realtime/",
      autoConnect: false,
      transports: ["websocket", "webtransport"],
    })
  );

  useEffect(() => {
    const connectToSocket = async () => {
      const socket = RealtimeSocketRef.current;
      if (user) {
        const token = await getIdToken();
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
