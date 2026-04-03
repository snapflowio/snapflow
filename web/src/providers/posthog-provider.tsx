/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ReactNode } from "react";
import { PostHogProvider } from "posthog-js/react";
import { env } from "@/env";

export function PosthogProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.DEV) return <>{children}</>;

  return (
    <PostHogProvider
      apiKey={env.VITE_POSTHOG_KEY}
      options={{
        api_host: env.VITE_POSTHOG_HOST,
        person_profiles: "always",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: true,
        capture_performance: true,
      }}
    >
      {children}
    </PostHogProvider>
  );
}
