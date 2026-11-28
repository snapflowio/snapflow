/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { APIRoute } from 'astro';
import { SITE_CONFIG } from '@/config/site';
import { Path } from '@/constants/paths';

const SECURITY_TXT_PATH = '/.well-known/security.txt';
const SECURITY_TXT_LIFETIME_DAYS = 180;
const MILLISECONDS_PER_DAY = 86_400_000;

export const GET: APIRoute = ({ site }) => {
	const expires = new Date(
		Date.now() + SECURITY_TXT_LIFETIME_DAYS * MILLISECONDS_PER_DAY
	);
	const fields = [
		`Contact: mailto:${SITE_CONFIG.ABUSE_EMAIL}`,
		`Contact: ${new URL(Path.ABUSE, site).href}`,
		`Expires: ${expires.toISOString()}`,
		'Preferred-Languages: en',
		`Canonical: ${new URL(SECURITY_TXT_PATH, site).href}`,
		`Policy: ${new URL(Path.ABUSE, site).href}`,
	];

	return new Response(`${fields.join('\n')}\n`, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
};
