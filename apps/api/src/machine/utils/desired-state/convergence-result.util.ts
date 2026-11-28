/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type ConvergenceResult,
	MachineErrorCode,
} from '@snapflow/machine-proto';
import type { JobErrorCode } from '../../../machine-job/enums/job-error-code.enum';
import type { JobExecutionResult } from '../../../machine-job/types/job-execution-result.types';
import {
	JOB_EXECUTION_OUTCOME,
	JOB_EXECUTION_RESULT_SCHEMA_VERSION,
	JOB_LIFECYCLE_PHASE,
	type JobLifecyclePhase,
	MACHINE_RELIABILITY_LIMITS,
} from '../../constants/machine-reliability.constants';
import { jobErrorCode } from '../machine-error-code.util';

const JOB_LIFECYCLE_PHASES: ReadonlySet<string> = new Set(
	Object.values(JOB_LIFECYCLE_PHASE)
);

function isJobLifecyclePhase(phase: string): phase is JobLifecyclePhase {
	return JOB_LIFECYCLE_PHASES.has(phase);
}

function lifecyclePhase(phase: string): JobLifecyclePhase {
	return isJobLifecyclePhase(phase) ? phase : JOB_LIFECYCLE_PHASE.UNKNOWN;
}

function errorCode(
	result: ConvergenceResult,
	succeeded: boolean
): JobErrorCode {
	if (result.errorCode !== MachineErrorCode.UNSPECIFIED) {
		return jobErrorCode(result.errorCode);
	}
	return jobErrorCode(
		succeeded ? MachineErrorCode.NONE : MachineErrorCode.UNKNOWN
	);
}

export function convergenceExecutionResult(
	result: ConvergenceResult,
	succeeded: boolean
): JobExecutionResult {
	return {
		schemaVersion: JOB_EXECUTION_RESULT_SCHEMA_VERSION,
		outcome: succeeded
			? JOB_EXECUTION_OUTCOME.SUCCEEDED
			: JOB_EXECUTION_OUTCOME.FAILED,
		phase: lifecyclePhase(result.phase),
		errorCode: errorCode(result, succeeded),
		retryable: result.retryable,
		diagnostic: result.diagnostic?.slice(
			0,
			MACHINE_RELIABILITY_LIMITS.DIAGNOSTIC
		),
		runtimeIdentity: result.runtimeIdentity.slice(
			0,
			MACHINE_RELIABILITY_LIMITS.IDENTITY
		),
		releaseIdentity: result.releaseIdentity.slice(
			0,
			MACHINE_RELIABILITY_LIMITS.IDENTITY
		),
		timingsMs: { ...result.timingsMs },
		evidence: { ...result.evidence },
	};
}
