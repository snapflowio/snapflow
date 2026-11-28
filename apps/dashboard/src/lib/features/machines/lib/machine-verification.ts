/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	MachineVerification,
	MachineVerificationChecklist,
} from '@snapflow/api-client';
import { MACHINE_TIER_LABELS } from '#lib/features/listings/lib/listing-format.ts';

type ChecklistFlag = {
	[Key in keyof MachineVerificationChecklist]: MachineVerificationChecklist[Key] extends boolean
		? Key
		: never;
}[keyof MachineVerificationChecklist];

export const VERIFICATION_CHECKS = [
	{ key: 'payoutWallet', label: 'Payout wallet set' },
	{ key: 'benchmark', label: 'Benchmark passed' },
	{ key: 'fingerprintUnique', label: 'Unique hardware' },
	{ key: 'networkMinimum', label: 'Network minimum' },
	{ key: 'diskMinimum', label: 'Disk minimum' },
] as const satisfies readonly { key: ChecklistFlag; label: string }[];

export function passedChecks(checklist: MachineVerificationChecklist): number {
	return VERIFICATION_CHECKS.filter((check) => checklist[check.key]).length;
}

export function verificationSummary(verification: MachineVerification): string {
	return `${MACHINE_TIER_LABELS[verification.tier]} · ${passedChecks(verification.checklist)} of ${VERIFICATION_CHECKS.length} checks`;
}
