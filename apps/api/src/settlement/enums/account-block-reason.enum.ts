/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const AccountBlockReason = {
	SANCTIONS: 'sanctions',
	FRAUD: 'fraud',
} as const;

export type AccountBlockReason =
	(typeof AccountBlockReason)[keyof typeof AccountBlockReason];

export const ACCOUNT_BLOCK_REASONS = [
	AccountBlockReason.SANCTIONS,
	AccountBlockReason.FRAUD,
] as const satisfies readonly AccountBlockReason[];
