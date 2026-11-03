/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const NETWORK_METER_POLICY = {
	linkToleranceBasisPoints: 1_000n,
	burstAllowanceBytes: 4n * 1_024n * 1_024n,
	bitsPerByte: 8n,
	bitsPerMegabit: 1_000_000n,
	millisecondsPerSecond: 1_000n,
} as const;
