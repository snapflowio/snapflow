/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { fromJsonString } from '@bufbuild/protobuf';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import {
	type BenchmarkMeasurements,
	BenchmarkMeasurementsSchema,
} from '@snapflow/machine-proto';
import { MILLISECONDS_PER_MINUTE } from '../../common/constants/time.constants';
import { addMinutes, millisecondsBetween } from '../../common/utils/time.util';
import { BasisPoints } from '../../common/values/basis-points.value';
import { ResourceShape } from '../../common/values/resource-shape.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Machine } from '../../machine/entities/machine.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import type { SettingsSnapshot } from '../../settings/types/settings.types';
import { BENCHMARK_PARAMETERS } from '../constants/benchmark-policy.constants';
import {
	SPOT_CHECK,
	SPOT_CHECK_ABORT,
	SPOT_CHECK_TOLERANCE_SUBJECT,
} from '../constants/spot-check.constants';
import { MachineSpotCheck } from '../entities/machine-spot-check.entity';
import { SpotCheckState } from '../enums/spot-check-state.enum';
import type { BenchmarkShapeValues } from '../types/benchmark.types';
import { appraiseCompute } from '../utils/measurement-appraisal.util';
import { parseBenchmarkNonce } from '../utils/nonce-stream.util';
import {
	spotCheckBenchmarkTool,
	spotCheckPlatform,
} from '../utils/spot-check-benchmark-tool.util';
import {
	hiddenVariableName,
	spotCheckChallengeJson,
	spotCheckCommand,
	spotCheckToolPath,
} from '../utils/spot-check-command.util';
import {
	compareSpotCheck,
	type SpotCheckBaseline,
} from '../utils/spot-check-comparison.util';
import {
	abortedSpotCheck,
	type SpotCheckOutcome,
	withCanaryFailures,
} from '../utils/spot-check-outcome.util';
import { SpotCheckCanaryService } from './spot-check-canary.service';
import { SpotCheckCompletionService } from './spot-check-completion.service';
import {
	type SpotCheckCredential,
	SpotCheckToolboxService,
} from './spot-check-toolbox.service';

const FAILED_SANDBOX_STATES: ReadonlySet<SandboxState> = new Set([
	SandboxState.ERROR,
	SandboxState.BUILD_FAILED,
	SandboxState.DESTROYING,
	SandboxState.DESTROYED,
	SandboxState.ARCHIVING,
	SandboxState.ARCHIVED,
]);

@Injectable()
export class SpotCheckRunService {
	private readonly logger = new Logger(SpotCheckRunService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly toolbox: SpotCheckToolboxService,
		private readonly completion: SpotCheckCompletionService,
		private readonly canary: SpotCheckCanaryService
	) {}

	async progress(checkId: string, settings: SettingsSnapshot): Promise<void> {
		const check = await this.entityManager.findOne(
			MachineSpotCheck,
			{ id: checkId, state: SpotCheckState.RUNNING },
			{ refresh: true }
		);
		if (!check?.sandboxId || !check.startedAt) return;
		const sandbox = await this.entityManager.findOne(
			Sandbox,
			{ id: check.sandboxId },
			{ refresh: true }
		);
		const organizationId = settings.spotCheckOrganizationId;
		if (
			!sandbox ||
			!organizationId ||
			FAILED_SANDBOX_STATES.has(sandbox.state)
		) {
			await this.completion.finish(
				check,
				abortedSpotCheck(SPOT_CHECK_ABORT.SANDBOX_FAILED)
			);
			return;
		}
		const now = await databaseNow(this.entityManager);
		if (sandbox.state !== SandboxState.STARTED) {
			if (
				millisecondsBetween(check.startedAt, now) >
				SPOT_CHECK.START_TIMEOUT_MINUTES * MILLISECONDS_PER_MINUTE
			) {
				await this.completion.finish(
					check,
					abortedSpotCheck(SPOT_CHECK_ABORT.START_TIMEOUT)
				);
			}
			return;
		}
		const credential = await this.toolbox.credential(
			this.entityManager,
			organizationId,
			now
		);
		if (!credential) {
			await this.completion.finish(
				check,
				abortedSpotCheck(SPOT_CHECK_ABORT.CREDENTIAL_MISSING)
			);
			return;
		}
		if (!check.canaryFinishedAt) {
			const aborted = await this.canary.transfer(check, sandbox, credential);
			if (aborted) {
				await this.completion.finish(check, abortedSpotCheck(aborted));
			}
			return;
		}
		const canary = await this.canary.judge(check, now);
		if (canary.state === 'pending') return;
		await this.completion.finish(
			check,
			canary.state === 'aborted'
				? abortedSpotCheck(canary.reason)
				: withCanaryFailures(
						await this.run(check, sandbox, credential, settings, now),
						canary.failures
					)
		);
	}

	private async run(
		check: MachineSpotCheck,
		sandbox: Sandbox,
		credential: SpotCheckCredential,
		settings: SettingsSnapshot,
		now: Date
	): Promise<SpotCheckOutcome> {
		const nonce = parseBenchmarkNonce(check.nonce);
		if (!nonce) throw new Error(`Spot check ${check.id} has no valid nonce`);
		const machine = await this.entityManager.findOneOrFail(Machine, {
			id: check.machineId,
		});
		const platform = spotCheckPlatform(
			machine.runtimeCapabilities?.guestPlatforms ?? []
		);
		if (!platform) {
			return abortedSpotCheck(SPOT_CHECK_ABORT.PLATFORM_UNSUPPORTED);
		}
		const tool = await spotCheckBenchmarkTool(platform);
		const shape: BenchmarkShapeValues =
			ResourceShape.fromSandbox(sandbox).toColumns();
		const challenge = spotCheckChallengeJson({
			id: check.id,
			nonce: check.nonce,
			shape,
			issuedAt: now,
			expiresAt: addMinutes(now, SPOT_CHECK.CHALLENGE_TTL_MINUTES),
		});
		const toolPath = spotCheckToolPath();
		let output: string;
		try {
			await this.toolbox.upload(sandbox.id, credential, toolPath, tool);
			const response = await this.toolbox.execute(
				sandbox.id,
				credential,
				spotCheckCommand(toolPath, hiddenVariableName(), challenge)
			);
			if (response.exitCode !== SPOT_CHECK.SUCCESS_EXIT_CODE) {
				return abortedSpotCheck(SPOT_CHECK_ABORT.COMMAND_FAILED);
			}
			output = response.result;
		} catch (error) {
			this.logger.warn(`Spot check ${check.id} toolbox call failed`, error);
			return abortedSpotCheck(SPOT_CHECK_ABORT.TOOLBOX_UNAVAILABLE);
		}
		const measurements = parseMeasurements(output);
		if (!measurements) {
			return abortedSpotCheck(SPOT_CHECK_ABORT.MALFORMED_OUTPUT);
		}
		return judgeSpotCheck(machine, nonce, shape, measurements, settings);
	}
}

function judgeSpotCheck(
	machine: Machine,
	nonce: Uint8Array,
	shape: BenchmarkShapeValues,
	measurements: BenchmarkMeasurements,
	settings: SettingsSnapshot
): SpotCheckOutcome {
	const baseline = spotCheckBaseline(machine);
	if (!baseline) {
		return abortedSpotCheck(SPOT_CHECK_ABORT.BASELINE_MISSING);
	}
	const appraisal = appraiseCompute(
		nonce,
		shape,
		measurements,
		{
			...BENCHMARK_PARAMETERS,
			minimumCapacityBasisPoints: BasisPoints.of(
				settings.spotCheckToleranceBasisPoints,
				SPOT_CHECK_TOLERANCE_SUBJECT
			)
				.complement()
				.toNumber(),
		},
		null
	);
	const reasons = appraisal.compute
		? compareSpotCheck(
				baseline,
				appraisal.compute,
				settings.spotCheckToleranceBasisPoints
			)
		: appraisal.failures;
	return reasons.length > 0
		? { state: SpotCheckState.FAILED, measurements, reasons }
		: { state: SpotCheckState.PASSED, measurements };
}

function parseMeasurements(output: string): BenchmarkMeasurements | null {
	try {
		return fromJsonString(BenchmarkMeasurementsSchema, output.trim());
	} catch {
		return null;
	}
}

function spotCheckBaseline(machine: Machine): SpotCheckBaseline | null {
	if (
		machine.measuredVcpu === null ||
		machine.cpuScorePerVcpu === null ||
		machine.memoryBandwidthMibps === null ||
		machine.diskRandomReadIops === null ||
		machine.diskSequentialMibps === null
	) {
		return null;
	}
	return {
		vcpu: machine.measuredVcpu,
		cpuScorePerVcpu: machine.cpuScorePerVcpu,
		memoryBandwidthMibps: machine.memoryBandwidthMibps,
		diskRandomReadIops: machine.diskRandomReadIops,
		diskSequentialMibps: machine.diskSequentialMibps,
		gpuTflops: machine.gpuTflops,
	};
}
