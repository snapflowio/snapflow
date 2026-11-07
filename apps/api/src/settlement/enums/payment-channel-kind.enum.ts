/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

// lease: pays a sandbox lease's host, fee and service charges to the host's
// payout wallet. platform_service: pays a customer organization's monthly
// platform fees (the private pool) to Snapflow's fee recipient, which the
// escrow treats as the channel's host with nothing paid to it as a host.
export const PaymentChannelKind = {
	LEASE: 'lease',
	PLATFORM_SERVICE: 'platform_service',
} as const;

export type PaymentChannelKind =
	(typeof PaymentChannelKind)[keyof typeof PaymentChannelKind];
