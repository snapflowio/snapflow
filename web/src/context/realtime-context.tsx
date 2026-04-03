/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createContext } from "react";
import { Socket } from "socket.io-client";

export interface IRealtimeContext {
  realtimeSocket: Socket | null;
}

export const RealtimeContext = createContext<IRealtimeContext | undefined>(undefined);
