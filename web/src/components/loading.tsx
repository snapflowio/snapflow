/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Loader2 } from "lucide-react";

export function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-bg">
      <Loader2 className="h-6 w-6 animate-spin text-text-icon" />
    </div>
  );
}
