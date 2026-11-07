/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OrganizationAccessService } from '../../auth/services/organization-access.service';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { fakeInstance, fakeValue } from '../../common/testing/instance.fake';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import type { PermissionPair } from '../../organization/utils/organization-permissions.util';
import { SETTLEMENT_PARTY_READ_PERMISSION } from '../constants/settlement.constants';
import { SettlementParty } from '../enums/settlement-party.enum';
import { SettlementPartyAccessService } from './settlement-party-access.service';

const AUTH_CONTEXT = fakeValue<OrganizationAuthContext>({});

function service(
	allowed: readonly SettlementParty[]
): SettlementPartyAccessService {
	const allowedPairs = allowed.map(
		(party) => SETTLEMENT_PARTY_READ_PERMISSION[party]
	);
	return new SettlementPartyAccessService(
		fakeInstance(OrganizationAccessService, {
			grantedToContext: async (
				_context: OrganizationAuthContext,
				requested: readonly PermissionPair[]
			) => requested.filter((pair) => allowedPairs.includes(pair)),
		})
	);
}

describe('SettlementPartyAccessService', () => {
	it('returns every party the caller may read when none is requested', async () => {
		assert.deepEqual(
			await service([SettlementParty.HOST]).readableParties(AUTH_CONTEXT),
			[SettlementParty.HOST]
		);
	});

	it('narrows to the requested party', async () => {
		assert.deepEqual(
			await service([
				SettlementParty.CUSTOMER,
				SettlementParty.HOST,
			]).readableParties(AUTH_CONTEXT, SettlementParty.CUSTOMER),
			[SettlementParty.CUSTOMER]
		);
	});

	it('refuses a requested party the caller may not read', async () => {
		await assert.rejects(
			service([SettlementParty.CUSTOMER]).readableParties(
				AUTH_CONTEXT,
				SettlementParty.HOST
			),
			AccessDeniedException
		);
	});
});
