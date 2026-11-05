/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BASIS_POINTS_DENOMINATOR } from '../../../common/constants/money.constants';
import { ceilDivide } from '../../../common/utils/fixed-point.util';
import { NETWORK_METER_POLICY } from '../../constants/machine-network-meter.constants';
import type { MachineNetworkBytes } from '../../constants/machine-usage.constants';

export interface NetworkLinkLimits {
	egressBitsPerSecond: bigint | null;
	ingressBitsPerSecond: bigint | null;
}

export interface MeasuredLink {
	networkUplinkMbps: number | null;
	networkDownlinkMbps: number | null;
}

export interface ClampedNetworkDeltas {
	acceptedInternetEgressBytes: bigint;
	acceptedInternetIngressBytes: bigint;
	clampedInternetEgressBytes: bigint;
	clampedInternetIngressBytes: bigint;
}

export function networkLinkLimits(
	link: MeasuredLink | null,
	sandboxEgressBitsPerSecond: readonly (number | null)[]
): NetworkLinkLimits {
	const egress = [
		megabits(link?.networkUplinkMbps ?? null),
		...sandboxEgressBitsPerSecond.map(bitsOrNull),
	].filter((value): value is bigint => value !== null);
	return {
		egressBitsPerSecond:
			egress.length === 0
				? null
				: egress.reduce((lowest, value) => (value < lowest ? value : lowest)),
		ingressBitsPerSecond: megabits(link?.networkDownlinkMbps ?? null),
	};
}

export function linkCapacityBytes(
	bitsPerSecond: bigint,
	intervalMillis: bigint
): bigint {
	const { bitsPerByte, millisecondsPerSecond, linkToleranceBasisPoints } =
		NETWORK_METER_POLICY;
	return (
		ceilDivide(
			bitsPerSecond *
				intervalMillis *
				(BASIS_POINTS_DENOMINATOR + linkToleranceBasisPoints),
			bitsPerByte * millisecondsPerSecond * BASIS_POINTS_DENOMINATOR
		) + NETWORK_METER_POLICY.burstAllowanceBytes
	);
}

export function clampNetworkDeltas(
	deltas: MachineNetworkBytes,
	intervalMillis: bigint,
	limits: NetworkLinkLimits
): ClampedNetworkDeltas {
	const egress = clamp(
		deltas.internetEgressBytes,
		limits.egressBitsPerSecond,
		intervalMillis
	);
	const ingress = clamp(
		deltas.internetIngressBytes,
		limits.ingressBitsPerSecond,
		intervalMillis
	);
	return {
		acceptedInternetEgressBytes: egress.accepted,
		acceptedInternetIngressBytes: ingress.accepted,
		clampedInternetEgressBytes: egress.clamped,
		clampedInternetIngressBytes: ingress.clamped,
	};
}

function clamp(
	delta: bigint,
	bitsPerSecond: bigint | null,
	intervalMillis: bigint
): { accepted: bigint; clamped: bigint } {
	if (bitsPerSecond === null) return { accepted: delta, clamped: 0n };
	const capacity = linkCapacityBytes(bitsPerSecond, intervalMillis);
	return delta > capacity
		? { accepted: capacity, clamped: delta - capacity }
		: { accepted: delta, clamped: 0n };
}

function megabits(value: number | null): bigint | null {
	return value === null || value <= 0
		? null
		: BigInt(Math.trunc(value)) * NETWORK_METER_POLICY.bitsPerMegabit;
}

function bitsOrNull(value: number | null): bigint | null {
	return value === null || value <= 0 ? null : BigInt(Math.trunc(value));
}
