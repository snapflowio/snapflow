/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MILLISECONDS_PER_DAY } from '../../common/constants/time.constants';
import { policyRevision } from '../../common/utils/policy-fingerprint.util';
import { addMilliseconds } from '../../common/utils/time.util';
import { SETTINGS_PROBLEM_CODE } from '../../settings/constants/settings.constants';
import { SettingsService } from '../../settings/services/settings.service';
import type { MachineControlPolicyDto } from '../dto/machine-control-policy.dto';
import type { MachineSession } from '../entities/machine-session.entity';
import { MachineConnectionCredentialService } from './machine-connection-credential.service';

const MACHINE_POLICY_SCHEMA_VERSION = 1;
const MACHINE_POLICY_LIFETIME_MILLISECONDS = MILLISECONDS_PER_DAY;

type MachineRuntimePolicy = Pick<
	MachineControlPolicyDto,
	| 'schemaVersion'
	| 'guestRegistryUrl'
	| 'desktopEnabled'
	| 'serialConsoleEnabled'
>;

@Injectable()
export class MachineControlPolicyService {
	constructor(
		private readonly settings: SettingsService,
		private readonly connectionCredentials: MachineConnectionCredentialService
	) {}

	async current(
		machineId: string,
		session: MachineSession
	): Promise<MachineControlPolicyDto> {
		const policy = await this.runtimePolicy();
		const issuedAt = new Date();
		return {
			...policy,
			revision: policyRevision(policy),
			issuedAt: issuedAt.toISOString(),
			expiresAt: addMilliseconds(
				issuedAt,
				MACHINE_POLICY_LIFETIME_MILLISECONDS
			).toISOString(),
			connectionToken: this.connectionCredentials.token(
				machineId,
				session.generation
			),
		};
	}

	private async runtimePolicy(): Promise<MachineRuntimePolicy> {
		const settings = await this.settings.get();
		if (!settings.machineGuestRegistryUrl) {
			throw new ServiceUnavailableException({
				code: SETTINGS_PROBLEM_CODE.NOT_CONFIGURED,
				message: 'The platform has no machine guest registry configured yet',
			});
		}
		return {
			schemaVersion: MACHINE_POLICY_SCHEMA_VERSION,
			guestRegistryUrl: settings.machineGuestRegistryUrl,
			desktopEnabled: settings.machineDesktopEnabled,
			serialConsoleEnabled: settings.machineSerialConsoleEnabled,
		};
	}
}
