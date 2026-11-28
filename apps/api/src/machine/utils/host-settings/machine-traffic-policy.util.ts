/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BASIS_POINTS_SCALE } from '../../../common/constants/money.constants';
import { SANDBOX_BANDWIDTH_LIMIT_MBPS } from '../../../settings/constants/settings.constants';
import type { SettingsSnapshot } from '../../../settings/types/settings.types';
import type { MachineTrafficPolicyDto } from '../../dto/machine-host-settings.dto';
import type { Machine } from '../../entities/machine.entity';

export const MACHINE_TRAFFIC_SETTING_KEYS = [
	'sandboxUploadBandwidthLimitMbps',
	'sandboxDownloadBandwidthLimitMbps',
	'sandboxBurstMib',
	'sandboxPacketsPerSecondLimit',
	'sandboxNewConnectionsPerSecond',
	'sandboxMaxConnections',
	'sandboxHostLinkShareBasisPoints',
	'abuseEnforcementMode',
] as const satisfies readonly (keyof SettingsSnapshot)[];

type TrafficSettings = Pick<
	SettingsSnapshot,
	(typeof MACHINE_TRAFFIC_SETTING_KEYS)[number]
>;

type MeasuredLinks = Pick<Machine, 'networkUplinkMbps' | 'networkDownlinkMbps'>;

function linkShareMbps(
	measuredMbps: number | null,
	shareBasisPoints: number
): number | null {
	if (measuredMbps === null || measuredMbps <= 0) return null;
	return Math.max(
		SANDBOX_BANDWIDTH_LIMIT_MBPS.MINIMUM,
		Math.floor((measuredMbps * shareBasisPoints) / BASIS_POINTS_SCALE)
	);
}

export function machineTrafficPolicy(
	links: MeasuredLinks,
	settings: TrafficSettings,
	monthlyTrafficCapGb: number | null
): MachineTrafficPolicyDto {
	const share = settings.sandboxHostLinkShareBasisPoints;
	const hostUploadLimitMbps = linkShareMbps(links.networkUplinkMbps, share);
	const hostDownloadMbps = linkShareMbps(links.networkDownlinkMbps, share);
	return {
		uploadBandwidthLimitMbps: Math.min(
			settings.sandboxUploadBandwidthLimitMbps,
			hostUploadLimitMbps ?? settings.sandboxUploadBandwidthLimitMbps
		),
		downloadBandwidthLimitMbps: Math.min(
			settings.sandboxDownloadBandwidthLimitMbps,
			hostDownloadMbps ?? settings.sandboxDownloadBandwidthLimitMbps
		),
		hostUploadLimitMbps,
		burstMib: settings.sandboxBurstMib,
		packetsPerSecond: settings.sandboxPacketsPerSecondLimit,
		newConnectionsPerSecond: settings.sandboxNewConnectionsPerSecond,
		maxConnections: settings.sandboxMaxConnections,
		enforcement: settings.abuseEnforcementMode,
		monthlyTrafficCapGb,
	};
}
