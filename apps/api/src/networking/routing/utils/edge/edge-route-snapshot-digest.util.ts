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
import type { EdgeRouteSnapshotDto } from '../../dto/edge-route-snapshot.dto';

export type EdgeRouteSnapshotContent = Omit<EdgeRouteSnapshotDto, 'digest'>;

export function edgeRouteSnapshotDigest(
	snapshot: EdgeRouteSnapshotContent
): string {
	return createHash(EDGE_IDENTITY.hashAlgorithm)
		.update(canonicalJson(snapshot))
		.digest('hex');
}
