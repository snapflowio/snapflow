/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { MACHINE_TRUST_POLICY } from '../../../billing/ledger/constants/machine-trust.constants';
import { MACHINE_QUALIFICATION_POLICY } from '../../../sandbox/machine/constants/machine-qualification.constants';
import { MachineAssessment } from '../../../sandbox/machine/entities/machine-assessment.entity';

export function currentAssessmentSql(alias: string): string {
	return `${alias}.qualified = true
		AND ${alias}."qualificationExpiresAt" > transaction_timestamp()
		AND ${alias}."qualificationPolicyVersion" = ${MACHINE_QUALIFICATION_POLICY.VERSION}
		AND ${alias}."policyVersion" = ${MACHINE_TRUST_POLICY.version}`;
}

export async function findCurrentMachineAssessment(
	manager: EntityManager,
	machineId: string,
	lockMode?: LockMode
): Promise<MachineAssessment | null> {
	const assessment = await manager.findOne(
		MachineAssessment,
		{ machineId },
		lockMode === undefined ? {} : { lockMode }
	);
	if (!assessment) return null;
	const [row] = await manager.execute<{ current: boolean }[]>(
		`SELECT EXISTS (
			SELECT 1 FROM machine_assessment assessment
			WHERE assessment."machineId" = ? AND ${currentAssessmentSql('assessment')}
		) AS current`,
		[machineId]
	);
	return row?.current === true ? assessment : null;
}
