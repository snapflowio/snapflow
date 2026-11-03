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
	NETWORK_BUDGET_EXHAUSTED = 'network_budget_exhausted',
}
