/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';

export const ACTION_COLUMN_WIDTH = 1.3;
export const AUDIT_EVENT_PARAM = 'event';

const dateParam = z
	.string()
	.refine((value) => !value || !Number.isNaN(Date.parse(value)))
	.catch('');

export const auditSearchSchema = z.object({
	search: z.string().catch(''),
	from: dateParam,
	to: dateParam,
});
