"use client";

import { createContext } from "react";
import { Socket } from "socket.io-client";

export interface IrealtimeSocketContext {
  realtimeSocket: Socket;
}

export const realtimeSocketContext = createContext<IrealtimeSocketContext | undefined>(undefined);
