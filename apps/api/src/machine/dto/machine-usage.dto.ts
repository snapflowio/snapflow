/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsEnum,
	IsInt,
	IsISO8601,
	IsNumberString,
	IsString,
	IsUUID,
	Matches,
	Min,
} from 'class-validator';
import { CursorPageDto } from '../../common/dto/cursor-page.dto';
import {
	type MachineUsageReceiptEnvelope,
	SHA256_HEX_PATTERN,
} from '../../usage/schemas/machine-usage-envelope.schema';
import { MachineUsageRuntimeState } from '../constants/machine-usage.constants';

export class MachineReportablePlacementDto {
	@ApiProperty({ format: 'uuid' })
	placementId: string;

	@ApiProperty()
	sandboxId: string;

	@ApiProperty({ type: 'integer' })
	assignmentGeneration: number;

	@ApiProperty({ format: 'uuid' })
	fencingToken: string;

	@ApiProperty({ format: 'date-time' })
	placedAt: string;

	@ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
	releasedAt: string | null;
}

export class MachineReportablePlacementPageDto extends CursorPageDto<MachineReportablePlacementDto> {
	@ApiProperty({ type: [MachineReportablePlacementDto] })
	declare items: MachineReportablePlacementDto[];
}

export class MachineUsageReceiptDto implements MachineUsageReceiptEnvelope {
	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	placementId: string;

	@ApiProperty()
	@IsString()
	sandboxId: string;

	@ApiProperty({ type: 'integer', minimum: 1 })
	@IsInt()
	@Min(1)
	assignmentGeneration: number;

	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	fencingToken: string;

	@ApiProperty({ format: 'uuid' })
	@IsUUID()
	generationId: string;

	@ApiProperty({
		description: 'Monotonic unsigned sequence in the runtime generation',
	})
	@IsNumberString({ no_symbols: true })
	sequence: string;

	@ApiProperty({
		description:
			'Payload digest of the previous reading in the placement runtime generation, or 64 zeros for its first reading',
		pattern: SHA256_HEX_PATTERN.source,
	})
	@Matches(SHA256_HEX_PATTERN)
	previousDigest: string;

	@ApiProperty({ format: 'date-time' })
	@IsISO8601({ strict: true })
	sampledAt: string;

	@ApiProperty({
		enum: MachineUsageRuntimeState,
		enumName: 'MachineUsageRuntimeState',
	})
	@IsEnum(MachineUsageRuntimeState)
	state: MachineUsageRuntimeState;

	@ApiProperty({
		description:
			'Cumulative milliseconds the runtime spent started in its generation',
	})
	@IsNumberString({ no_symbols: true })
	runningMillis: string;

	@ApiProperty({
		description:
			'Cumulative bytes the guest sent to the internet in the runtime generation (billable egress candidate)',
	})
	@IsNumberString({ no_symbols: true })
	internetEgressBytes: string;

	@ApiProperty({
		description:
			'Cumulative bytes the guest received on connections it opened to the internet in the runtime generation',
	})
	@IsNumberString({ no_symbols: true })
	internetIngressBytes: string;

	@ApiProperty({
		description:
			'Cumulative bytes the guest sent to the host, which relays Edge exposure responses',
	})
	@IsNumberString({ no_symbols: true })
	hostEgressBytes: string;

	@ApiProperty({
		description:
			'Cumulative bytes the host sent to the guest, which relays Edge exposure requests',
	})
	@IsNumberString({ no_symbols: true })
	hostIngressBytes: string;

	@ApiProperty({
		description:
			'Cumulative frame bytes the guest transmitted on its TAP device',
	})
	@IsNumberString({ no_symbols: true })
	tapEgressBytes: string;

	@ApiProperty({
		description: 'Cumulative frame bytes the guest received on its TAP device',
	})
	@IsNumberString({ no_symbols: true })
	tapIngressBytes: string;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	cpu: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	memoryGiB: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	diskGiB: number;

	@ApiProperty({ type: 'integer', minimum: 0 })
	@IsInt()
	@Min(0)
	gpu: number;

	@ApiProperty({
		description: 'Ed25519 signature encoded as unpadded base64url',
	})
	@IsString()
	signature: string;
}

export class AcceptedMachineUsageReceiptDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty()
	payloadDigest: string;

	@ApiProperty()
	acceptedComputeDeltaMillis: string;

	@ApiProperty()
	acceptedStorageDeltaMillis: string;

	@ApiProperty({
		description:
			'Internet egress bytes accepted for billing after the physical link clamp',
	})
	acceptedInternetEgressDeltaBytes: string;

	@ApiProperty({
		description:
			'Internet ingress bytes accepted after the physical link clamp; ingress is never charged',
	})
	acceptedInternetIngressDeltaBytes: string;
}
