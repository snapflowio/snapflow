/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import type { MachineBenchmark } from '../entities/machine-benchmark.entity';
import { BenchmarkState } from '../enums/benchmark-state.enum';
import { BenchmarkTrigger } from '../enums/benchmark-trigger.enum';

@ApiSchema({ name: 'MachineBenchmark' })
export class MachineBenchmarkDto {
	@ApiProperty({ format: 'uuid' }) id: string;
	@ApiProperty({ enum: BenchmarkTrigger, enumName: 'BenchmarkTrigger' })
	trigger: BenchmarkTrigger;
	@ApiProperty({ enum: BenchmarkState, enumName: 'BenchmarkState' })
	state: BenchmarkState;
	@ApiProperty() suiteVersion: number;
	@ApiProperty({ type: String, format: 'date-time' }) issuedAt: Date;
	@ApiProperty({ type: String, format: 'date-time' }) expiresAt: Date;
	@ApiProperty({ type: String, format: 'date-time', nullable: true })
	completedAt: Date | null;
	@ApiProperty({ type: [String] }) failureReasons: string[];

	static from(benchmark: MachineBenchmark): MachineBenchmarkDto {
		return {
			id: benchmark.id,
			trigger: benchmark.trigger,
			state: benchmark.state,
			suiteVersion: benchmark.suiteVersion,
			issuedAt: benchmark.issuedAt,
			expiresAt: benchmark.expiresAt,
			completedAt: benchmark.completedAt,
			failureReasons: benchmark.failureReasons,
		};
	}
}

@ApiSchema({ name: 'MachineVerificationChecklist' })
export class MachineVerificationChecklistDto {
	@ApiProperty({
		description: 'A verified payout wallet that is not sanctioned is linked',
	})
	payoutWallet: boolean;
	@ApiProperty({
		description: 'The latest benchmark passed for the current inventory',
	})
	benchmark: boolean;
	@ApiProperty() fingerprintUnique: boolean;
	@ApiProperty() networkMinimum: boolean;
	@ApiProperty() diskMinimum: boolean;
	@ApiProperty() listedDays: number;
	@ApiProperty() uptimeBasisPoints: number;
	@ApiProperty() spotChecksPassed30d: number;
}

@ApiSchema({ name: 'MachineVerification' })
export class MachineVerificationDto {
	@ApiProperty({ enum: MachineTier, enumName: 'MachineTier' })
	tier: MachineTier;
	@ApiProperty({ type: [String] }) reasons: string[];
	@ApiProperty({ type: MachineVerificationChecklistDto })
	checklist: MachineVerificationChecklistDto;
	@ApiProperty({ type: MachineBenchmarkDto, nullable: true })
	latestBenchmark: MachineBenchmarkDto | null;
}
