/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { create, fromJsonString, toJsonString } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { BadRequestException } from '@nestjs/common';
import {
	type SandboxObservedStatus,
	type SandboxObservedStatusAcknowledgement,
	SandboxObservedStatusAcknowledgementSchema,
	SandboxObservedStatusReportResultSchema,
	SandboxObservedStatusReportSchema,
	type SandboxObservedStatusVerdict,
	SandboxRuntimeState,
} from '@snapflow/machine-proto';
import { apiError } from '../../../common/utils/error/api-error.util';
import { errorMessage } from '../../../common/utils/error/error.util';
import { MACHINE_OBSERVED_STATUS_LIMITS } from '../../../machine/constants/machine-desired-state.constants';
import { MachineApiErrorCode } from '../../../machine/enums/machine-api-error-code.enum';

export function decodeObservedStatusReport(
	encodedReport: string
): SandboxObservedStatus[] {
	let statuses: SandboxObservedStatus[];
	try {
		statuses = fromJsonString(
			SandboxObservedStatusReportSchema,
			encodedReport
		).statuses;
	} catch (error) {
		throw new BadRequestException(
			apiError(
				MachineApiErrorCode.REPORT_INVALID,
				`The report is not a valid sandbox status report: ${errorMessage(error)}. Send a valid report.`
			),
			{ cause: error }
		);
	}
	if (
		statuses.length > MACHINE_OBSERVED_STATUS_LIMITS.maximumStatusesPerReport
	) {
		throw new BadRequestException(
			apiError(
				MachineApiErrorCode.REPORT_INVALID,
				`A report can carry at most ${MACHINE_OBSERVED_STATUS_LIMITS.maximumStatusesPerReport} statuses. Split the report and send it again.`
			)
		);
	}
	return statuses;
}

type ObservedStatusValidation =
	| { valid: true; observedAt: Date }
	| { valid: false; defect: string };

export function validateObservedStatus(
	status: SandboxObservedStatus
): ObservedStatusValidation {
	if (!status.sandboxId) {
		return { valid: false, defect: 'sandbox_id is required' };
	}
	if (status.assignmentGeneration === 0) {
		return { valid: false, defect: 'assignment_generation must be positive' };
	}
	if (status.state === SandboxRuntimeState.UNSPECIFIED) {
		return { valid: false, defect: 'state is required' };
	}
	if (!status.observedAt) {
		return { valid: false, defect: 'observed_at is required' };
	}
	return { valid: true, observedAt: timestampDate(status.observedAt) };
}

export function observedStatusAcknowledgement(
	sandboxId: string,
	verdict: SandboxObservedStatusVerdict,
	reason?: string
): SandboxObservedStatusAcknowledgement {
	return create(SandboxObservedStatusAcknowledgementSchema, {
		sandboxId,
		verdict,
		reason,
	});
}

export function encodeObservedStatusReportResult(
	acknowledgements: SandboxObservedStatusAcknowledgement[]
): string {
	return toJsonString(
		SandboxObservedStatusReportResultSchema,
		create(SandboxObservedStatusReportResultSchema, { acknowledgements })
	);
}
