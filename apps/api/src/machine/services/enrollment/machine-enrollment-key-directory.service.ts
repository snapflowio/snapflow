/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	Injectable,
	ServiceUnavailableException,
} from '@nestjs/common';
import {
	MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS,
	MachineEnrollmentKeyErrorCode,
} from '../../../auth/constants/machine-enrollment-key.constants';
import { MachineEnrollmentKeyService } from '../../../auth/services/machine-enrollment-key.service';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { MachineEnrollmentErrorCode } from '../../constants/machine-enrollment.constants';
import {
	type CreatedMachineEnrollmentKeyDto,
	type CreateMachineEnrollmentKeyDto,
	MachineEnrollmentKeyDto,
	type MachineEnrollmentKeyListDto,
} from '../../dto/machine-enrollment-key.dto';
import { enrollmentKeyMachineCounts } from '../../queries/enrollment-key-usage.query';
import { machineInstallCommand } from '../../utils/enrollment/machine-install-command.util';

const SINGLE_USE_BY_DEFAULT = true;

@Injectable()
export class MachineEnrollmentKeyDirectoryService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly enrollmentKeys: MachineEnrollmentKeyService,
		private readonly config: TypedConfigService
	) {}

	async create(
		authContext: OrganizationAuthContext,
		input: CreateMachineEnrollmentKeyDto
	): Promise<CreatedMachineEnrollmentKeyDto> {
		const websiteUrl = this.config.get('websiteUrl');
		if (!websiteUrl) {
			throw new ServiceUnavailableException({
				code: MachineEnrollmentErrorCode.WEBSITE_URL_REQUIRED,
				message: 'WEBSITE_URL is not configured, so there is no install script',
			});
		}
		const singleUse = input.singleUse ?? SINGLE_USE_BY_DEFAULT;
		const created = await this.enrollmentKeys.create({
			organizationId: authContext.organizationId,
			userId: authContext.userId,
			name: input.name,
			singleUse,
			expiresInSeconds: lifetimeSeconds(singleUse, input.expiresIn),
		});
		return {
			id: created.id,
			name: created.name,
			start: created.start,
			singleUse,
			enabled: created.enabled !== false,
			expiresAt: created.expiresAt ? new Date(created.expiresAt) : null,
			lastUsedAt: null,
			createdByUserId: authContext.userId,
			createdAt: new Date(created.createdAt),
			machineCount: 0,
			key: created.key,
			installCommand: machineInstallCommand(websiteUrl, created.key),
		};
	}

	async list(organizationId: string): Promise<MachineEnrollmentKeyListDto> {
		const keys = await this.enrollmentKeys.list(organizationId);
		const counts = await enrollmentKeyMachineCounts(
			this.entityManager.fork(),
			organizationId,
			keys.map((key) => key.id)
		);
		return {
			items: keys.map((key) =>
				MachineEnrollmentKeyDto.from(key, counts.get(key.id) ?? 0)
			),
		};
	}

	revoke(organizationId: string, keyId: string): Promise<void> {
		return this.enrollmentKeys.revoke(organizationId, keyId);
	}
}

function lifetimeSeconds(
	singleUse: boolean,
	requested: number | undefined
): number {
	const limits = MACHINE_ENROLLMENT_KEY_LIFETIME_SECONDS;
	const maximum = singleUse
		? limits.SINGLE_USE_MAXIMUM
		: limits.REUSABLE_MAXIMUM;
	if (requested !== undefined && requested > maximum) {
		throw new BadRequestException({
			code: MachineEnrollmentKeyErrorCode.LIFETIME_TOO_LONG,
			message: `A ${singleUse ? 'single-use' : 'fleet'} enrollment key lives at most ${maximum} seconds`,
		});
	}
	return (
		requested ??
		(singleUse ? limits.SINGLE_USE_DEFAULT : limits.REUSABLE_DEFAULT)
	);
}
