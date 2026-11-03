/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../../common/utils/canonical-json.util';
import { EDGE_IDENTITY } from '../../constants/edge.constants';
import type { EdgeUsageCheckpointDto } from '../../dto/edge-usage.dto';
import { sortByBackendId } from '../exposure/backend-order.util';

export function edgeUsageDigest(
	edgeId: string,
	checkpoint: Omit<
		EdgeUsageCheckpointDto,
		'digest' | 'signature' | 'previousDigest'
	> & { previousDigest: string | null }
): string {
	return createHash(EDGE_IDENTITY.hashAlgorithm)
		.update(
			canonicalJson({
				edgeId,
				...checkpoint,
				samples: sortByBackendId(checkpoint.samples),
			})
		)
		.digest('hex');
}

export function edgeUsageSignaturePayload(
	edgeId: string,
	checkpoint: Pick<EdgeUsageCheckpointDto, 'usageEpoch' | 'sequence' | 'digest'>
): Buffer {
	return Buffer.from(
		[
			EDGE_IDENTITY.usageProofDomain,
			edgeId,
			String(checkpoint.usageEpoch),
			checkpoint.sequence,
			checkpoint.digest,
		].join('\n'),
		'utf8'
	);
}
