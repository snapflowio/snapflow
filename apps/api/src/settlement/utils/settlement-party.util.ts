/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SettlementParty } from '../enums/settlement-party.enum';

interface PartyOrganizations {
	customerOrganizationId: string | null;
	hostOrganizationId: string | null;
}

type PartyOrganizationFilter =
	| Pick<PartyOrganizations, 'customerOrganizationId'>
	| Pick<PartyOrganizations, 'hostOrganizationId'>;

const PARTY_FILTER: Readonly<
	Record<SettlementParty, (organizationId: string) => PartyOrganizationFilter>
> = {
	[SettlementParty.CUSTOMER]: (organizationId) => ({
		customerOrganizationId: organizationId,
	}),
	[SettlementParty.HOST]: (organizationId) => ({
		hostOrganizationId: organizationId,
	}),
};

export function partyFilter(
	organizationId: string,
	parties: readonly SettlementParty[]
): { $or: PartyOrganizationFilter[] } {
	return { $or: parties.map((party) => PARTY_FILTER[party](organizationId)) };
}

export function partiesOf(
	record: PartyOrganizations,
	organizationId: string
): SettlementParty[] {
	return [
		...(record.customerOrganizationId === organizationId
			? [SettlementParty.CUSTOMER]
			: []),
		...(record.hostOrganizationId === organizationId
			? [SettlementParty.HOST]
			: []),
	];
}
