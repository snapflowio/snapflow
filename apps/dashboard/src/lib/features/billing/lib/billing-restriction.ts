/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BillingRestriction } from '@snapflow/api-client';

interface BillingRestrictionNotice {
	title: string;
	description: string;
}

export const BILLING_RESTRICTION_NOTICES: Record<
	BillingRestriction,
	BillingRestrictionNotice
> = {
	[BillingRestriction.InsufficientCredit]: {
		title: 'Insufficient credit to start this sandbox',
		description: 'Add credit to your balance, then create the sandbox.',
	},
	[BillingRestriction.MonthlyBudgetExhausted]: {
		title: 'Monthly budget exhausted',
		description: 'Raise the budget or wait for the next period.',
	},
	[BillingRestriction.NetworkBudgetExhausted]: {
		title: 'Network budget exhausted',
		description: 'Raise the budget or wait for the next period.',
	},
};
