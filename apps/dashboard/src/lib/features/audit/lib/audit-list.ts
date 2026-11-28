/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';
import { Path } from '#lib/routing/paths.ts';
import { searchParamArray } from '#lib/routing/search-params.ts';
import { resolve } from '$app/paths';
import { AUDIT_CATEGORIES, AUDIT_VIAS } from './audit-event.ts';

export const AUDIT_EVENT_PARAM = 'event';
export const AUDIT_ACTOR_PARAM = 'actor';

const dateParam = z
	.string()
	.refine((value) => !value || !Number.isNaN(Date.parse(value)))
	.catch('');

export const auditSearchSchema = z.object({
	search: z.string().catch(''),
	from: dateParam,
	to: dateParam,
	actor: searchParamArray(z.string()).catch([]),
	category: searchParamArray(z.enum(AUDIT_CATEGORIES)).catch([]),
	via: searchParamArray(z.enum(AUDIT_VIAS)).catch([]),
});

export function auditActorHref(actorId: string): string {
	const search = new URLSearchParams({ [AUDIT_ACTOR_PARAM]: actorId });
	return `${resolve(Path.AUDIT)}?${search}`;
}
