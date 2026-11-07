/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

// delegated: Snapflow's signer signs each voucher within the session key the
// customer granted it. client: the customer's SDK or agent signs each voucher
// with its own key.
export const VoucherSigningMode = {
	DELEGATED: 'delegated',
	CLIENT: 'client',
} as const;

export type VoucherSigningMode =
	(typeof VoucherSigningMode)[keyof typeof VoucherSigningMode];
