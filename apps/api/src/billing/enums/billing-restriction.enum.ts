/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum BillingRestriction {
	INSUFFICIENT_CREDIT = 'insufficient_credit',
	MONTHLY_BUDGET_EXHAUSTED = 'monthly_budget_exhausted',
	API_KEY_BUDGET_EXHAUSTED = 'api_key_budget_exhausted',
	API_KEY_BUDGET_WOULD_BE_EXCEEDED = 'api_key_budget_would_be_exceeded',
	API_KEY_CONCURRENCY_EXHAUSTED = 'api_key_concurrency_exhausted',
}
