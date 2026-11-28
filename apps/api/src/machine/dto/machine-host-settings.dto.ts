/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsDefined,
	IsInt,
	IsString,
	Matches,
	Max,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import {
	AbuseEnforcementMode,
	SANDBOX_BANDWIDTH_LIMIT_MBPS,
	SANDBOX_BURST_MIB,
	SANDBOX_MAX_CONNECTIONS,
	SANDBOX_NEW_CONNECTIONS_PER_SECOND,
	SANDBOX_PACKETS_PER_SECOND,
} from '../../settings/constants/settings.constants';
import {
	MACHINE_DEFAULT_UNCLAIMED_FLOAT_USDC,
	MACHINE_MAINTENANCE_WINDOW,
	MACHINE_OFFER_LIMITS,
	MACHINE_UNCLAIMED_FLOAT_PATTERN,
} from '../constants/machine-host-settings.constants';

const LAST_MINUTE_OF_DAY = MACHINE_MAINTENANCE_WINDOW.MINUTES_PER_DAY - 1;
const isSet = (_input: object, value: unknown) => value !== null;

function offerProperty(maximum: number, description: string) {
	return {
		type: 'integer',
		nullable: true,
		minimum: 1,
		maximum,
		description: `${description}; null offers all the machine admits`,
	} as const;
}

@ApiSchema({ name: 'MachineMaintenanceWindow' })
export class MachineMaintenanceWindowDto {
	@ApiProperty({
		type: 'integer',
		description: 'Minute of the UTC day the window opens at; 240 is 04:00 UTC',
		minimum: 0,
		maximum: LAST_MINUTE_OF_DAY,
		example: 240,
	})
	@IsInt()
	@Min(0)
	@Max(LAST_MINUTE_OF_DAY)
	startMinuteUtc: number;

	@ApiProperty({
		type: 'integer',
		description: 'How long the window stays open; it may run past midnight',
		minimum: MACHINE_MAINTENANCE_WINDOW.MINIMUM_DURATION_MINUTES,
		maximum: MACHINE_MAINTENANCE_WINDOW.MAXIMUM_DURATION_MINUTES,
		example: 120,
	})
	@IsInt()
	@Min(MACHINE_MAINTENANCE_WINDOW.MINIMUM_DURATION_MINUTES)
	@Max(MACHINE_MAINTENANCE_WINDOW.MAXIMUM_DURATION_MINUTES)
	durationMinutes: number;
}

@ApiSchema({ name: 'MachineOffer' })
class MachineOfferDto {
	@ApiProperty(
		offerProperty(MACHINE_OFFER_LIMITS.MAXIMUM_VCPUS, 'Most vCPUs offered')
	)
	@ValidateIf(isSet)
	@IsInt()
	@Min(1)
	@Max(MACHINE_OFFER_LIMITS.MAXIMUM_VCPUS)
	vcpus: number | null;

	@ApiProperty(
		offerProperty(
			MACHINE_OFFER_LIMITS.MAXIMUM_MEMORY_GIB,
			'Most memory offered, in GiB'
		)
	)
	@ValidateIf(isSet)
	@IsInt()
	@Min(1)
	@Max(MACHINE_OFFER_LIMITS.MAXIMUM_MEMORY_GIB)
	memoryGiB: number | null;

	@ApiProperty(
		offerProperty(
			MACHINE_OFFER_LIMITS.MAXIMUM_DISK_GIB,
			'Most disk offered, in GiB'
		)
	)
	@ValidateIf(isSet)
	@IsInt()
	@Min(1)
	@Max(MACHINE_OFFER_LIMITS.MAXIMUM_DISK_GIB)
	diskGiB: number | null;
}

@ApiSchema({ name: 'MachineHostSettings' })
export class MachineHostSettingsDto {
	@ApiProperty({
		type: MachineMaintenanceWindowDto,
		nullable: true,
		description:
			'The daily UTC window the machine applies release updates in; null keeps its default, 04:00 to 06:00 UTC',
	})
	@IsDefined()
	@ValidateIf(isSet)
	@ValidateNested()
	@Type(() => MachineMaintenanceWindowDto)
	maintenanceWindow: MachineMaintenanceWindowDto | null;

	@ApiProperty({
		type: MachineOfferDto,
		description: 'The capacity the machine offers to sandboxes',
	})
	@ValidateNested()
	@Type(() => MachineOfferDto)
	offer: MachineOfferDto;

	@ApiProperty({
		type: String,
		nullable: true,
		pattern: MACHINE_UNCLAIMED_FLOAT_PATTERN.source,
		description: `Most signed but unclaimed value, in USDC base units, a payment channel may carry before the machine holds its sandbox; null keeps the default of ${MACHINE_DEFAULT_UNCLAIMED_FLOAT_USDC} USDC`,
		example: '25000000',
	})
	@IsDefined()
	@ValidateIf(isSet)
	@IsString()
	@Matches(MACHINE_UNCLAIMED_FLOAT_PATTERN)
	maxUnclaimedFloat: string | null;
}

@ApiSchema({ name: 'MachineTrafficPolicy' })
export class MachineTrafficPolicyDto {
	@ApiProperty({
		type: 'integer',
		description: 'Upload limit of every sandbox on this machine, Mbps',
		minimum: SANDBOX_BANDWIDTH_LIMIT_MBPS.MINIMUM,
		maximum: SANDBOX_BANDWIDTH_LIMIT_MBPS.MAXIMUM,
	})
	uploadBandwidthLimitMbps: number;

	@ApiProperty({
		type: 'integer',
		description: 'Download limit of every sandbox on this machine, Mbps',
		minimum: SANDBOX_BANDWIDTH_LIMIT_MBPS.MINIMUM,
		maximum: SANDBOX_BANDWIDTH_LIMIT_MBPS.MAXIMUM,
	})
	downloadBandwidthLimitMbps: number;

	@ApiProperty({
		type: 'integer',
		nullable: true,
		minimum: SANDBOX_BANDWIDTH_LIMIT_MBPS.MINIMUM,
		description:
			'Combined upload limit of all sandboxes on this machine, Mbps, from its measured uplink; null until the uplink is measured',
	})
	hostUploadLimitMbps: number | null;

	@ApiProperty({
		type: 'integer',
		description:
			'Traffic a sandbox may send or receive at full speed before its limits apply, MiB',
		minimum: SANDBOX_BURST_MIB.MINIMUM,
		maximum: SANDBOX_BURST_MIB.MAXIMUM,
	})
	burstMib: number;

	@ApiProperty({
		type: 'integer',
		description: 'Packets per second a sandbox may send',
		minimum: SANDBOX_PACKETS_PER_SECOND.MINIMUM,
		maximum: SANDBOX_PACKETS_PER_SECOND.MAXIMUM,
	})
	packetsPerSecond: number;

	@ApiProperty({
		type: 'integer',
		description: 'New outbound connections per second a sandbox may open',
		minimum: SANDBOX_NEW_CONNECTIONS_PER_SECOND.MINIMUM,
		maximum: SANDBOX_NEW_CONNECTIONS_PER_SECOND.MAXIMUM,
	})
	newConnectionsPerSecond: number;

	@ApiProperty({
		type: 'integer',
		description: 'Open connections a sandbox may hold',
		minimum: SANDBOX_MAX_CONNECTIONS.MINIMUM,
		maximum: SANDBOX_MAX_CONNECTIONS.MAXIMUM,
	})
	maxConnections: number;

	@ApiProperty({
		enum: AbuseEnforcementMode,
		enumName: 'AbuseEnforcementMode',
		description: 'Observe counts over-limit traffic; enforce drops it',
	})
	enforcement: AbuseEnforcementMode;

	@ApiProperty({
		type: Number,
		nullable: true,
		description:
			"The host's monthly traffic cap, GB; the machine reports reaching it",
	})
	monthlyTrafficCapGb: number | null;
}

@ApiSchema({ name: 'MachineHostSettingsDocument' })
export class MachineHostSettingsDocumentDto extends MachineHostSettingsDto {
	@ApiProperty({ type: 'integer', minimum: 1 })
	schemaVersion: number;

	@ApiProperty({ type: MachineTrafficPolicyDto })
	traffic: MachineTrafficPolicyDto;

	@ApiProperty({
		type: [String],
		description:
			"Public IPv4 addresses the platform sees this machine connect from; sandboxes must not reach them, since they lead back to the host's router and its port forwards",
	})
	publicAddresses: string[];

	@ApiProperty({
		description: 'Lowercase hexadecimal SHA-256 of the document',
	})
	digest: string;
}
