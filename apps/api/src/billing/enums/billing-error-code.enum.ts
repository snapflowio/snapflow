/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum BillingErrorCode {
	AMOUNT_NOT_POSITIVE = 'billing_amount_not_positive',
	LINE_CHARGE_POSTED = 'billing_line_charge_posted',
	CREDIT_INVALID = 'billing_credit_invalid',
	USAGE_NOT_FOUND = 'billing_usage_not_found',
	LINE_ITEM_NOT_FOUND = 'billing_line_item_not_found',
}
