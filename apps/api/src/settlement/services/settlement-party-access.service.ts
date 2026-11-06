/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { OrganizationAccessService } from '../../auth/services/organization-access.service';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import {
	SETTLEMENT_PARTIES,
	SETTLEMENT_PARTY_READ_PERMISSION,
} from '../constants/settlement.constants';
import type { SettlementParty } from '../enums/settlement-party.enum';

@Injectable()
export class SettlementPartyAccessService {
	constructor(private readonly organizationAccess: OrganizationAccessService) {}

	// A requested party the caller may not read is refused rather than
	// silently returning nothing.
	async readableParties(
		authContext: OrganizationAuthContext,
		requested?: SettlementParty
	): Promise<SettlementParty[]> {
		const candidates = requested ? [requested] : SETTLEMENT_PARTIES;
		const granted = await this.organizationAccess.grantedToContext(
			authContext,
			candidates.map((party) => SETTLEMENT_PARTY_READ_PERMISSION[party])
		);
		const parties = candidates.filter((party) =>
			granted.some(
				({ resource, action }) =>
					resource === SETTLEMENT_PARTY_READ_PERMISSION[party].resource &&
					action === SETTLEMENT_PARTY_READ_PERMISSION[party].action
			)
		);
		if (parties.length === 0) throw new AccessDeniedException();
		return parties;
	}
}
