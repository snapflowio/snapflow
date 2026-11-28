/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	PUBLIC_POSTHOG_HOST,
	PUBLIC_POSTHOG_PROJECT_KEY,
} from 'astro:env/client';
import type { AnalyticsConfig } from '@snapflow/consent';

export const ANALYTICS: AnalyticsConfig | undefined =
	PUBLIC_POSTHOG_PROJECT_KEY && PUBLIC_POSTHOG_HOST
		? { projectKey: PUBLIC_POSTHOG_PROJECT_KEY, host: PUBLIC_POSTHOG_HOST }
		: undefined;
