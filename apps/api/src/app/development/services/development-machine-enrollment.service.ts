/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PersonalOrganizationService } from '../../../organization/tenant/services/personal-organization.service';
import type {
	MachineRegistrationDto,
	RegisterMachineDto,
} from '../../../sandbox/machine/dto/machine-registration.dto';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import { MachineAdministrationService } from '../../../sandbox/machine/services/machine-administration.service';
import { MachineRegistrationService } from '../../../sandbox/machine/services/machine-registration.service';
import { parseMachineIdentity } from '../../../sandbox/machine/utils/machine-identity.util';
import { UserService } from '../../../user/services/user.service';

@Injectable()
export class DevelopmentMachineEnrollmentService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly users: UserService,
		private readonly personalOrganizations: PersonalOrganizationService,
		private readonly registrations: MachineRegistrationService,
		private readonly administration: MachineAdministrationService
	) {}

	async enroll(
		input: RegisterMachineDto,
		address: string | undefined
	): Promise<MachineRegistrationDto> {
		const administrator = await this.users.findOldestAdministrator();
		if (!administrator) {
			throw new ServiceUnavailableException(
				'No administrator exists yet; the development seed creates one when the API starts'
			);
		}
		const owner = await this.personalOrganizations.ensure(administrator.id);
		const { keyId } = parseMachineIdentity(input.identityPublicKey);
		const named = await this.entityManager.findOne(Machine, {
			organizationId: owner.id,
			name: input.name.trim(),
		});
		if (named?.identityKeyId && named.identityKeyId !== keyId) {
			await this.administration.revokeIdentity(named.id);
		}
		return this.registrations.register(owner.id, input, address);
	}
}
