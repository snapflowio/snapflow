/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BASIS_POINTS_DENOMINATOR } from '../../common/constants/money.constants';
import { NETWORK_METER_AUDIT } from '../constants/network-meter-audit.constants';

export const HostTrafficVerdict = {
	CONSISTENT: 'consistent',
	INFLATED: 'inflated',
	UNDERCOUNTED: 'undercounted',
	INSUFFICIENT: 'insufficient',
} as const;

export type HostTrafficVerdict =
	(typeof HostTrafficVerdict)[keyof typeof HostTrafficVerdict];

export function reconcileHostTraffic(
	hostEgressBytes: bigint,
	edgeEgressBytes: bigint
): HostTrafficVerdict {
	if (edgeEgressBytes < NETWORK_METER_AUDIT.MINIMUM_EDGE_BYTES) {
		return HostTrafficVerdict.INSUFFICIENT;
	}
	const ceiling =
		(edgeEgressBytes *
			(BASIS_POINTS_DENOMINATOR +
				NETWORK_METER_AUDIT.HOST_OVERHEAD_BASIS_POINTS)) /
			BASIS_POINTS_DENOMINATOR +
		NETWORK_METER_AUDIT.IDLE_ALLOWANCE_BYTES;
	if (hostEgressBytes > ceiling) return HostTrafficVerdict.INFLATED;
	const floor =
		(edgeEgressBytes * NETWORK_METER_AUDIT.HOST_FLOOR_BASIS_POINTS) /
		BASIS_POINTS_DENOMINATOR;
	return hostEgressBytes < floor
		? HostTrafficVerdict.UNDERCOUNTED
		: HostTrafficVerdict.CONSISTENT;
}
