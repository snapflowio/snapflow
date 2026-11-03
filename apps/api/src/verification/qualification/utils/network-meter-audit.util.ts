/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BASIS_POINTS_DENOMINATOR } from '../../../common/constants/money.constants';
import { NETWORK_METER_AUDIT } from '../constants/network-meter-audit.constants';

export const HostTrafficVerdict = {
	CONSISTENT: 'consistent',
	INFLATED: 'inflated',
	UNDERCOUNTED: 'undercounted',
	INSUFFICIENT: 'insufficient',
} as const;

export type HostTrafficVerdict =
	(typeof HostTrafficVerdict)[keyof typeof HostTrafficVerdict];

export interface MachineEgressRate {
	organizationId: string;
	machineId: string;
	bytesPerHour: number;
}

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

export function anomalousMachines(
	rates: readonly MachineEgressRate[]
): string[] {
	const byOrganization = new Map<string, MachineEgressRate[]>();
	for (const rate of rates) {
		const fleet = byOrganization.get(rate.organizationId) ?? [];
		fleet.push(rate);
		byOrganization.set(rate.organizationId, fleet);
	}
	const flaggingCustomers = new Map<string, number>();
	for (const fleet of byOrganization.values()) {
		if (fleet.length < NETWORK_METER_AUDIT.ANOMALY_MINIMUM_MACHINES) continue;
		for (const candidate of fleet) {
			const others = fleet
				.filter(({ machineId }) => machineId !== candidate.machineId)
				.map(({ bytesPerHour }) => bytesPerHour);
			if (
				zScore(candidate.bytesPerHour, others) >=
				NETWORK_METER_AUDIT.ANOMALY_Z_SCORE
			) {
				flaggingCustomers.set(
					candidate.machineId,
					(flaggingCustomers.get(candidate.machineId) ?? 0) + 1
				);
			}
		}
	}
	return [...flaggingCustomers]
		.filter(
			([, customers]) =>
				customers >= NETWORK_METER_AUDIT.ANOMALY_MINIMUM_CUSTOMERS
		)
		.map(([machineId]) => machineId)
		.sort();
}

function zScore(value: number, others: readonly number[]): number {
	const mean =
		others.reduce((total, other) => total + other, 0) / others.length;
	const variance =
		others.reduce((total, other) => total + (other - mean) ** 2, 0) /
		others.length;
	const spread = Math.max(
		Math.sqrt(variance),
		mean * NETWORK_METER_AUDIT.ANOMALY_SPREAD_FLOOR_SHARE,
		NETWORK_METER_AUDIT.ANOMALY_SPREAD_FLOOR_BYTES
	);
	return (value - mean) / spread;
}
