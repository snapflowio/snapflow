/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { AbuseEnforcementMode } from '../../settings/constants/settings.constants';
import {
	ABUSE_LADDER,
	AbuseCaseStatus,
	AbuseSignalKind,
	AbuseSignalSeverity,
} from '../constants/abuse.constants';
import type { MachineAbuseFindingDto } from '../dto/machine-abuse-report.dto';
import type { AbuseCase } from '../entities/abuse-case.entity';
import type { AbuseFindings } from '../types/abuse-finding.types';

export function mergeFindings(
	current: AbuseFindings,
	reported: readonly MachineAbuseFindingDto[],
	observedAt: Date
): AbuseFindings {
	const merged: AbuseFindings = { ...current };
	const lastSeenAt = observedAt.toISOString();
	for (const { kind, ...finding } of reported) {
		merged[kind] = { ...finding, lastSeenAt };
	}
	return merged;
}

export function findingKinds(findings: AbuseFindings): AbuseSignalKind[] {
	return Object.values(AbuseSignalKind).filter((kind) => findings[kind]);
}

export function nextAbuseStatus(
	abuseCase: Pick<AbuseCase, 'status' | 'throttledAt'>,
	reported: readonly MachineAbuseFindingDto[],
	mode: AbuseEnforcementMode,
	now: Date
): AbuseCaseStatus {
	if (
		abuseCase.status === AbuseCaseStatus.SUSPENDED ||
		mode === AbuseEnforcementMode.OBSERVE
	) {
		return abuseCase.status;
	}
	if (reported.some(({ severity }) => severity === AbuseSignalSeverity.HARD)) {
		return AbuseCaseStatus.SUSPENDED;
	}
	const throttledFor = abuseCase.throttledAt
		? now.getTime() - abuseCase.throttledAt.getTime()
		: 0;
	return throttledFor >= ABUSE_LADDER.suspendAfterThrottledMilliseconds
		? AbuseCaseStatus.SUSPENDED
		: AbuseCaseStatus.THROTTLED;
}
