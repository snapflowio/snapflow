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
	EXPOSURE_BACKEND_STATE,
	type ExposureBackendState,
} from '../constants/exposure.constants';
import {
	MACHINE_EDGE_BINDING_DESIRED_STATE,
	type MachineEdgeBindingDesiredState,
} from '../constants/machine-tunnel.constants';
import {
	NETWORK_PROTOCOL,
	type NetworkProtocol,
} from '../constants/networking.constants';

export class MachineTunnelTargetDto {
	@ApiProperty({ format: 'uuid' })
	backendId: string;

	@ApiProperty({ format: 'uuid' })
	exposureId: string;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 1 })
	exposureGeneration: number;

	@ApiProperty()
	sandboxId: string;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 1 })
	assignmentGeneration: number;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	placementFencingTokenHash: string;

	@ApiProperty({ enum: NETWORK_PROTOCOL, enumName: 'NetworkProtocol' })
	protocol: NetworkProtocol;

	@ApiProperty()
	targetHost: string;

	@ApiPropertyOptional()
	targetReference?: string;

	@ApiPropertyOptional({
		description:
			'Host-local authenticated guest service to proxy for this HTTP target',
	})
	guestService?: string;

	@ApiProperty({
		type: 'integer',
		format: 'int32',
		minimum: 1,
		maximum: 65_535,
	})
	targetPort: number;

	@ApiProperty({
		enum: EXPOSURE_BACKEND_STATE,
		enumName: 'ExposureBackendState',
	})
	state: ExposureBackendState;

	@ApiProperty({ format: 'date-time' })
	leaseExpiresAt: string;
}

export class MachineTunnelBindingDto {
	@ApiProperty({ format: 'uuid' })
	edgeId: string;

	@ApiProperty()
	edgeHost: string;

	@ApiProperty({
		type: 'integer',
		format: 'int32',
		minimum: 1,
		maximum: 65_535,
	})
	edgePort: number;

	@ApiProperty({ format: 'uuid' })
	bindingId: string;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 1 })
	bindingRevision: number;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	bindingDigest: string;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 1 })
	targetRevision: number;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	targetDigest: string;

	@ApiProperty({
		enum: MACHINE_EDGE_BINDING_DESIRED_STATE,
		enumName: 'MachineEdgeBindingDesiredState',
	})
	desiredState: MachineEdgeBindingDesiredState;

	@ApiProperty({ format: 'date-time' })
	leaseExpiresAt: string;

	@ApiProperty({ type: [MachineTunnelTargetDto] })
	targets: MachineTunnelTargetDto[];
}

export class MachineTunnelPlanDto {
	@ApiProperty({ format: 'uuid' })
	machineId: string;

	@ApiProperty({ type: 'integer', format: 'int32', minimum: 1 })
	machineSessionGeneration: number;

	@ApiProperty({ description: 'Monotonic machine tunnel-plan version' })
	version: string;

	@ApiProperty({ minLength: 64, maxLength: 64 })
	digest: string;

	@ApiProperty({ format: 'date-time' })
	generatedAt: string;

	@ApiProperty({ format: 'date-time' })
	expiresAt: string;

	@ApiProperty({ type: [MachineTunnelBindingDto] })
	bindings: MachineTunnelBindingDto[];
}
