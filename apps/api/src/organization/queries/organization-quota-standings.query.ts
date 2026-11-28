/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import {
	ORGANIZATION_ROLE,
	ORGANIZATION_ROLE_SEPARATOR,
} from '@snapflow/organization-access';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { DEPOSITED_EVENT } from '../../settlement/constants/escrow.constants';
import type { EscrowIdentity } from '../../settlement/types/escrow.types';
import { SystemRole } from '../../user/enums/system-role.enum';
import type { QuotaTierStanding } from '../types/quota-tier.types';

interface StandingRow {
	organizationId: string;
	verifiedEmail: boolean;
	lifetimeDeposits: string;
	trailingDeposits: string;
}

export async function organizationQuotaStandings(
	manager: EntityManager,
	escrow: EscrowIdentity,
	organizationIds: readonly string[],
	trailingSince: Date
): Promise<QuotaTierStanding[]> {
	if (organizationIds.length === 0) return [];
	const rows = await manager.execute<StandingRow[]>(
		`SELECT organization.id AS "organizationId",
		   EXISTS (
		     SELECT 1
		     FROM member
		     JOIN "user" member_user ON member_user.id = member."userId"
		     WHERE member."organizationId" = organization.id
		       AND string_to_array(member.role, ?) && ARRAY[?]::text[]
		       AND (member_user."emailVerified" OR member_user.role = ?)
		   ) AS "verifiedEmail",
		   COALESCE(SUM((event.args->>'amount')::numeric), 0)::text AS "lifetimeDeposits",
		   COALESCE(SUM((event.args->>'amount')::numeric)
		     FILTER (WHERE event."blockTimestamp" >= ?), 0)::text AS "trailingDeposits"
		 FROM organization
		 LEFT JOIN escrow_event event
		   ON event."customerOrganizationId" = organization.id
		  AND event.kind = ?
		  AND event."processedAt" IS NOT NULL
		  AND event."chainId" = ?
		  AND event."contractAddress" = ?
		 WHERE organization.id IN (?)
		 GROUP BY organization.id`,
		[
			ORGANIZATION_ROLE_SEPARATOR,
			ORGANIZATION_ROLE.OWNER,
			SystemRole.ADMIN,
			trailingSince,
			DEPOSITED_EVENT,
			escrow.chainId,
			escrow.contractAddress,
			[...organizationIds],
		]
	);
	return rows.map((row) => ({
		organizationId: row.organizationId,
		verifiedEmail: row.verifiedEmail,
		lifetimeDeposits: MicroUsd.parse(row.lifetimeDeposits),
		trailingDeposits: MicroUsd.parse(row.trailingDeposits),
	}));
}
