/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';
import { MACHINE_OBSERVED_STATUS_LIMITS } from '../constants/machine-desired-state.constants';

const MINIMUM_ASSIGNMENT_GENERATION = 1;
const MINIMUM_SPEC_GENERATION = 1;

export class MachineDesiredStateDocumentDto {
	@ApiProperty({
		description: 'Lowercase hexadecimal SHA-256 of the document',
	})
	digest: string;

	@ApiProperty({
		description: 'Proto3 JSON of machine.v1alpha1.MachineDesiredState',
	})
	document: string;
}

export class MachineObservedStatusReportDto {
	@ApiProperty({
		description: 'Proto3 JSON of machine.v1alpha1.SandboxObservedStatusReport',
		maxLength: MACHINE_OBSERVED_STATUS_LIMITS.maximumDocumentLength,
	})
	@IsString()
	@MaxLength(MACHINE_OBSERVED_STATUS_LIMITS.maximumDocumentLength)
	report: string;
}

export class MachineObservedStatusResultDto {
	@ApiProperty({
		description:
			'Proto3 JSON of machine.v1alpha1.SandboxObservedStatusReportResult',
	})
	result: string;
}

export class MachineSandboxSecretsQueryDto {
	@ApiProperty({
		type: 'integer',
		minimum: MINIMUM_ASSIGNMENT_GENERATION,
		description: 'Assignment generation the machine converges',
	})
	@Type(() => Number)
	@IsInt()
	@Min(MINIMUM_ASSIGNMENT_GENERATION)
	assignmentGeneration: number;

	@ApiProperty({
		type: 'integer',
		minimum: MINIMUM_SPEC_GENERATION,
		description: 'Spec generation the machine converges',
	})
	@Type(() => Number)
	@IsInt()
	@Min(MINIMUM_SPEC_GENERATION)
	specGeneration: number;
}

export class MachineSandboxSecretsDto {
	@ApiProperty({
		description: 'Proto3 JSON of machine.v1alpha1.SandboxSecrets',
	})
	secrets: string;
}
