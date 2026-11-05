/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	JobExecutionOutcome,
	JobLifecyclePhase,
} from '../../machine/constants/machine-reliability.constants';
import type { JobErrorCode } from '../enums/job-error-code.enum';

export interface JobExecutionResult {
	schemaVersion: number;
	outcome: JobExecutionOutcome;
	phase: JobLifecyclePhase;
	errorCode: JobErrorCode;
	retryable: boolean;
	diagnostic?: string;
	runtimeIdentity: string;
	releaseIdentity: string;
	timingsMs?: Record<string, number>;
	evidence?: Record<string, string | number | boolean>;
}
