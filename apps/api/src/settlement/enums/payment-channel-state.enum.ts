/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

// open: the lease runs, or the service month is under way. closing: the lease
// or month ended and its last charges are still being billed. closed: the
// final voucher was issued.
export const PaymentChannelState = {
	OPEN: 'open',
	CLOSING: 'closing',
	CLOSED: 'closed',
} as const;

export type PaymentChannelState =
	(typeof PaymentChannelState)[keyof typeof PaymentChannelState];
