/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import * as z from 'zod';

export const HISTORY_VIEW_PARAM = 'view';
export const HISTORY_RECORD_PARAM = 'id';
export const ACCOUNT_CHANGES_PARAM = 'changes';
const ACCOUNT_CHANGES_ON = String(true);

export const HistoryView = {
	Transactions: 'transactions',
	Statements: 'statements',
} as const;

export type HistoryView = (typeof HistoryView)[keyof typeof HistoryView];

export const HISTORY_SEGMENTS = [
	{ value: HistoryView.Transactions, label: 'Transactions' },
	{ value: HistoryView.Statements, label: 'Statements' },
] as const satisfies readonly { value: HistoryView; label: string }[];

export const historySearchSchema = z.object({
	[HISTORY_VIEW_PARAM]: z
		.enum([HistoryView.Transactions, HistoryView.Statements])
		.catch(HistoryView.Transactions),
	[ACCOUNT_CHANGES_PARAM]: z
		.string()
		.optional()
		.transform((value) => value === ACCOUNT_CHANGES_ON)
		.catch(false),
});

export function historyViewSearch(view: HistoryView): string {
	return new URLSearchParams({ [HISTORY_VIEW_PARAM]: view }).toString();
}
