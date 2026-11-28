/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	EDGE_USAGE_CHAIN_POSITION,
	type EdgeUsageChainPosition,
} from '../../constants/edge.constants';
import type { EdgeUsageCheckpointDto } from '../../dto/edge-usage.dto';
import type { EdgeUsageCheckpoint } from '../../entities/edge-usage-checkpoint.entity';

export function edgeUsageChainPosition(
	input: Pick<
		EdgeUsageCheckpointDto,
		'usageEpoch' | 'sequence' | 'previousDigest'
	>,
	currentEpoch: number,
	latest: Pick<EdgeUsageCheckpoint, 'usageEpoch' | 'sequence' | 'digest'> | null
): EdgeUsageChainPosition {
	if (input.usageEpoch !== currentEpoch) {
		return EDGE_USAGE_CHAIN_POSITION.EPOCH_CLOSED;
	}
	const expectedSequence =
		latest?.usageEpoch === currentEpoch ? BigInt(latest.sequence) + 1n : 1n;
	const sequence = BigInt(input.sequence);
	if (sequence < expectedSequence) {
		return EDGE_USAGE_CHAIN_POSITION.CONFLICT;
	}
	if (
		sequence > expectedSequence ||
		(input.previousDigest ?? null) !== (latest?.digest ?? null)
	) {
		return EDGE_USAGE_CHAIN_POSITION.EPOCH_CLOSED;
	}
	return EDGE_USAGE_CHAIN_POSITION.NEXT;
}
