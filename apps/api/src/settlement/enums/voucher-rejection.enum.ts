/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

// Why a voucher could not be signed or a submitted signature was refused;
// each mirrors a check the escrow makes when the voucher is claimed.
export const VoucherRejection = {
	SIGNATURE_INVALID: 'voucher_signature_invalid',
	SIGNER_NOT_AUTHORIZED: 'voucher_signer_not_authorized',
	SESSION_KEY_INACTIVE: 'session_key_inactive',
	SESSION_SPEND_CAP_EXCEEDED: 'session_spend_cap_exceeded',
	SESSION_HOURLY_CAP_EXCEEDED: 'session_hourly_cap_exceeded',
} as const;

export type VoucherRejection =
	(typeof VoucherRejection)[keyof typeof VoucherRejection];
