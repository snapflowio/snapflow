/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PUBLIC_SITE_URL } from 'astro:env/client';

const siteUrl = new URL(PUBLIC_SITE_URL);

export const SITE_CONFIG = {
	NAME: 'Snapflow',
	DESCRIPTION:
		'Browse independently operated machines, compare prices, and deploy containerized workloads in isolated sandboxes.',
	URL: siteUrl.origin,
	DOMAIN: siteUrl.hostname,
	SUPPORT_EMAIL: 'support@snapflow.io',
	SALES_EMAIL: 'sales@snapflow.io',
	DISCORD_URL: 'https://discord.gg/eRTyxTkqPV',
} as const;
