/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { MILLISECONDS_PER_HOUR } from '../../../common/constants/time.constants';
import { canonicalJson } from '../../../common/utils/canonical-json.util';
import { addMilliseconds } from '../../../common/utils/time.util';
import { MACHINE_QUALIFICATION_POLICY } from '../../constants/machine-qualification.constants';
import type { Machine } from '../../entities/machine.entity';
import type { MachineRuntimeCapabilities } from '../../types/machine-runtime.types';

const MACHINE_ENVIRONMENT_CAPABILITY_FIELDS = [
	'kvmAvailable',
	'cgroupV2Available',
	'firecrackerSnapshotAvailable',
	'firecrackerTemplateAvailable',
	'hypervisors',
	'guestPlatforms',
	'features',
] as const satisfies readonly (keyof MachineRuntimeCapabilities)[];

export function machineQualificationInputFingerprint(machine: Machine): string {
	const { runtimeCapabilities } = machine;
	const environment = runtimeCapabilities
		? Object.fromEntries(
				MACHINE_ENVIRONMENT_CAPABILITY_FIELDS.map((field) => [
					field,
					runtimeCapabilities[field],
				])
			)
		: null;
	return `sha256:${sha256(
		canonicalJson({
			machineId: machine.id,
			machineKeyId: machine.identityKeyId,
			environment,
		})
	)}`;
}

export function machineQualificationExpiresAt(completedAt: Date): Date {
	return addMilliseconds(
		completedAt,
		MACHINE_QUALIFICATION_POLICY.QUALIFICATION_TTL_HOURS * MILLISECONDS_PER_HOUR
	);
}

export function machineQualificationRenewalDue(
	completedAt: Date,
	now: Date
): boolean {
	return (
		addMilliseconds(
			machineQualificationExpiresAt(completedAt),
			-MACHINE_QUALIFICATION_POLICY.RENEWAL_LEAD_HOURS * MILLISECONDS_PER_HOUR
		) <= now
	);
}

export function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}
