/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const VoucherLimit = {
	CUSTOMER_BALANCE: 'customer_balance',
	SIGNER_CAP: 'signer_cap',
	SIGNER_MISSING: 'signer_missing',
	SIGNER_THAWING: 'signer_thawing',
	SIGNER_REVOKED: 'signer_revoked',
	SIGNER_EXPIRED: 'signer_expired',
	SIGNER_SCOPE: 'signer_scope',
} as const;

export type VoucherLimit = (typeof VoucherLimit)[keyof typeof VoucherLimit];
