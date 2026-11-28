/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { BillingReceiptErrorCode } from '../constants/billing-receipt.constants';
import {
	BillingProfileDto,
	type UpdateBillingProfileDto,
} from '../dto/billing-profile.dto';
import { BillingProfile } from '../entities/billing-profile.entity';

@Injectable()
export class BillingProfileService {
	constructor(private readonly entityManager: EntityManager) {}

	async get(organizationId: string): Promise<BillingProfileDto> {
		const profile = await this.entityManager.fork().findOne(BillingProfile, {
			organizationId,
		});
		if (!profile) {
			throw new NotFoundException({
				code: BillingReceiptErrorCode.PROFILE_NOT_FOUND,
				message: 'The organization has no billing details yet',
			});
		}
		return BillingProfileDto.from(profile);
	}

	update(
		organizationId: string,
		input: UpdateBillingProfileDto
	): Promise<BillingProfileDto> {
		return this.entityManager.fork().transactional(async (manager) => {
			await manager.upsert(
				BillingProfile,
				{
					organizationId,
					legalName: input.legalName,
					addressLine1: input.addressLine1,
					addressLine2: input.addressLine2 ?? null,
					city: input.city,
					region: input.region ?? null,
					postalCode: input.postalCode ?? null,
					country: input.country,
					taxId: input.taxId ?? null,
					updatedAt: await databaseNow(manager),
				},
				{ onConflictFields: ['organizationId'] }
			);
			return BillingProfileDto.from(
				await manager.findOneOrFail(BillingProfile, { organizationId })
			);
		});
	}
}
