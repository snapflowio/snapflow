/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ConflictException,
	ForbiddenException,
	Injectable,
	ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { apiError } from '../../common/utils/error/api-error.util';
import { softDeleteOrganization } from '../../organization/better-auth/organization-deletion';
import { ORGANIZATION_HAS_LIVE_RESOURCES_CODE } from '../../organization/constants/live-organization-resource.constants';
import { ORGANIZATION_ERROR } from '../../organization/constants/organization-errors.constants';
import { OrganizationService } from '../../organization/services/organization.service';
import { OrganizationOwnershipService } from '../../organization/services/organization-ownership.service';
import {
	HELD_FUND_LABEL,
	type HeldFund,
	HeldFundsErrorCode,
} from '../../settlement/constants/held-funds.constants';
import { HeldFundsService } from '../../settlement/services/funds/held-funds.service';
import { isChainUnreachable } from '../../settlement/utils/chain-error.util';
import type { Auth } from '../better-auth/better-auth.config';
import { InjectBetterAuth } from '../better-auth/better-auth.provider';
import type { OrganizationDeletionBlockersDto } from '../dto/deletion-blockers.dto';

@Injectable()
export class OrganizationDeletionService {
	constructor(
		@InjectBetterAuth() private readonly auth: Auth,
		private readonly eventEmitter: EventEmitter2,
		private readonly organizations: OrganizationService,
		private readonly ownership: OrganizationOwnershipService,
		private readonly heldFunds: HeldFundsService
	) {}

	async blockers(
		organizationId: string
	): Promise<OrganizationDeletionBlockersDto> {
		const [liveResources, heldFunds] = await Promise.all([
			this.ownership.findLiveResources(organizationId),
			this.organizationFunds(organizationId),
		]);
		return { liveResources, heldFunds };
	}

	async delete(organizationId: string): Promise<void> {
		const organization = await this.organizations.findOneOrFail(organizationId);
		if (organization.personal) {
			throw new ForbiddenException(
				ORGANIZATION_ERROR.PERSONAL_ORGANIZATION_UNDELETABLE
			);
		}
		const { liveResources, heldFunds } = await this.blockers(organizationId);
		if (liveResources.length > 0) {
			throw new ConflictException({
				code: ORGANIZATION_HAS_LIVE_RESOURCES_CODE,
				message: `The organization still owns ${liveResources.join(', ')}. Delete them before deleting the organization.`,
			});
		}
		if (heldFunds.length > 0) {
			throw new ConflictException(
				apiError(
					HeldFundsErrorCode.ORGANIZATION_HOLDS_FUNDS,
					`The organization still holds ${heldFunds.map((fund) => HELD_FUND_LABEL[fund]).join(', ')}. Withdraw them before deleting the organization.`
				)
			);
		}
		await softDeleteOrganization(
			await this.auth.$context,
			this.eventEmitter,
			organizationId
		);
	}

	private async organizationFunds(organizationId: string): Promise<HeldFund[]> {
		try {
			return await this.heldFunds.organization(organizationId);
		} catch (error) {
			if (!isChainUnreachable(error)) throw error;
			throw new ServiceUnavailableException(
				apiError(
					HeldFundsErrorCode.FUNDS_UNREADABLE,
					'Escrow balances cannot be read right now; retry shortly before deleting the organization'
				)
			);
		}
	}
}
