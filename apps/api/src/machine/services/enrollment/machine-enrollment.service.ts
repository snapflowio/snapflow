/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException, Injectable } from '@nestjs/common';
import { MachineEnrollmentKeyService } from '../../../auth/services/machine-enrollment-key.service';
import { CommonErrorCode } from '../../../common/enums/common-error-code.enum';
import { apiError } from '../../../common/utils/error/api-error.util';
import { isUniqueViolation } from '../../../common/utils/error/database-error.util';
import type {
	EnrollMachineDto,
	MachineEnrollmentDto,
} from '../../dto/machine-enrollment.dto';
import { MachineRegistrationService } from '../connection/machine-registration.service';

@Injectable()
export class MachineEnrollmentService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly enrollmentKeys: MachineEnrollmentKeyService,
		private readonly registrations: MachineRegistrationService
	) {}

	async enroll(
		input: EnrollMachineDto,
		address: string | undefined
	): Promise<MachineEnrollmentDto> {
		const proof = await this.registrations.checkProof(
			this.entityManager,
			input
		);
		const key = await this.enrollmentKeys.verify(input.token);
		try {
			return await this.entityManager.fork().transactional(async (manager) => {
				await this.enrollmentKeys.spend(manager, key.id);
				return this.registrations.register(manager, {
					...proof,
					organizationId: key.organizationId,
					enrollmentKeyId: key.id,
					address,
				});
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictException(
					apiError(
						CommonErrorCode.OPERATION_IN_PROGRESS,
						'This machine is already being enrolled. Wait for that enrollment to finish.'
					),
					{ cause: error }
				);
			}
			throw error;
		}
	}
}
