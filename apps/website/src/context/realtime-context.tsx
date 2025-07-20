import { createContext } from "react";
import { Socket } from "socket.io-client";

export interface IRealtimeContext {
  realtimeSocket: Socket;
}

export const RealtimeContext = createContext<IRealtimeContext | undefined>(undefined);
