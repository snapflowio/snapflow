/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export interface BlockRange {
	fromBlock: bigint;
	toBlock: bigint;
}

// The next inclusive range after the last indexed block (or from the first
// block when nothing is indexed yet), never past the confirmed head and never
// wider than maximumBlocks; null when the confirmed head is already indexed.
export function nextBlockRange(
	lastIndexedBlock: bigint | null,
	firstBlock: bigint,
	confirmedHead: bigint,
	maximumBlocks: bigint
): BlockRange | null {
	const fromBlock =
		lastIndexedBlock === null ? firstBlock : lastIndexedBlock + 1n;
	if (fromBlock > confirmedHead) return null;
	const widest = fromBlock + maximumBlocks - 1n;
	return {
		fromBlock,
		toBlock: widest < confirmedHead ? widest : confirmedHead,
	};
}
