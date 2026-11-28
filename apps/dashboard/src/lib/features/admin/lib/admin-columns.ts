/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResourceColumnMeta } from '#lib/components/resource/table/resource-table.ts';

const COLUMN_WIDTH = {
	STATUS: 136,
	BADGE: 104,
	TIME: 140,
	MONEY: 104,
	COUNT: 88,
	TAG: 120,
	LABEL: 160,
} as const;

const COLUMN_GROW = {
	NAME: 2,
	WIDE: 2,
	DATA: 1,
} as const;

export const NAME_COLUMN = {
	grow: COLUMN_GROW.NAME,
} as const satisfies ResourceColumnMeta;
export const WIDE_COLUMN = {
	grow: COLUMN_GROW.WIDE,
} as const satisfies ResourceColumnMeta;
export const GROW_COLUMN = {
	grow: COLUMN_GROW.DATA,
} as const satisfies ResourceColumnMeta;
export const STATUS_COLUMN = {
	width: COLUMN_WIDTH.STATUS,
} as const satisfies ResourceColumnMeta;
export const BADGE_COLUMN = {
	width: COLUMN_WIDTH.BADGE,
} as const satisfies ResourceColumnMeta;
export const TIME_COLUMN = {
	width: COLUMN_WIDTH.TIME,
} as const satisfies ResourceColumnMeta;
export const TAG_COLUMN = {
	width: COLUMN_WIDTH.TAG,
} as const satisfies ResourceColumnMeta;
export const LABEL_COLUMN = {
	width: COLUMN_WIDTH.LABEL,
} as const satisfies ResourceColumnMeta;
export const MONEY_COLUMN = {
	width: COLUMN_WIDTH.MONEY,
	align: 'end',
} as const satisfies ResourceColumnMeta;
export const COUNT_COLUMN = {
	width: COLUMN_WIDTH.COUNT,
	align: 'end',
} as const satisfies ResourceColumnMeta;
