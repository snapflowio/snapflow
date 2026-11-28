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
import type {
	MachineEnrollmentDto,
	MachineEnrollmentProofDto,
} from '../../machine/dto/machine-enrollment.dto';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineRegistrationService } from '../../machine/services/connection/machine-registration.service';
import { MachineAdministrationService } from '../../machine/services/machine-administration.service';
import { PersonalOrganizationService } from '../../organization/services/personal-organization.service';
import { UserService } from '../../user/services/user.service';

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
		input: MachineEnrollmentProofDto,
		address: string | undefined
	): Promise<MachineEnrollmentDto> {
		const administrator = await this.users.findOldestAdministrator();
		if (!administrator) {
			throw new ServiceUnavailableException(
				'No administrator exists yet; the development seed creates one when the API starts'
			);
		}
		const owner = await this.personalOrganizations.ensure(administrator.id);
		const proof = await this.registrations.checkProof(
			this.entityManager,
			input
		);
		const named = await this.entityManager.findOne(Machine, {
			organizationId: owner.id,
			name: proof.name,
		});
		if (named?.identityKeyId && named.identityKeyId !== proof.identity.keyId) {
			await this.administration.revokeIdentity(named.id);
		}
		return this.entityManager.fork().transactional((manager) =>
			this.registrations.register(manager, {
				...proof,
				organizationId: owner.id,
				enrollmentKeyId: null,
				address,
			})
		);
	}
}
