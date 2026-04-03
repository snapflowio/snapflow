/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';

const envSchema = z.object({
	VITE_WEBSITE_URL: z.string(),
	VITE_POSTHOG_KEY: z.string().optional().default(''),
	VITE_POSTHOG_HOST: z.string().optional().default(''),
	VITE_API_URL: z.string(),
	VITE_PROXY_TEMPLATE_URL: z.string(),
	VITE_SHOW_ENTERPRISE: z
		.string()
		.optional()
		.default('false')
		.transform((val) => val === 'true'),
});

export const env = envSchema.parse(import.meta.env);
