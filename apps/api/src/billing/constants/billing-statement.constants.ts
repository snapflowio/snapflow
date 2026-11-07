/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const BillingStatementErrorCode = {
	MONTH_INVALID: 'statement_month_invalid',
} as const;

export type BillingStatementErrorCode =
	(typeof BillingStatementErrorCode)[keyof typeof BillingStatementErrorCode];

export const STATEMENT_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
