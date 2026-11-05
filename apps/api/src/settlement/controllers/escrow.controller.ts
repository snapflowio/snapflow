/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { OrganizationAccessService } from '../../auth/services/organization-access.service';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import { ESCROW_EVENT_READ_PERMISSION } from '../constants/escrow.constants';
import {
	EscrowAccountDto,
	EscrowEventPageDto,
	ListEscrowEventsQueryDto,
} from '../dto/escrow.dto';
import { EscrowEventParty } from '../enums/escrow-event-party.enum';
import { EscrowAccountService } from '../services/escrow-account.service';

const ESCROW_EVENT_PARTIES = Object.values(EscrowEventParty);

@Controller('settlement')
@ApiTags('settlement')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class EscrowController {
	constructor(
		private readonly accounts: EscrowAccountService,
		private readonly organizationAccess: OrganizationAccessService
	) {}

	@Get('escrow')
	@ApiOperation({
		summary:
			"Get the escrow account of the active organization's funding wallet",
		operationId: 'getEscrowAccount',
	})
	@ApiResponse({ status: HttpStatus.OK, type: EscrowAccountDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	account(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<EscrowAccountDto> {
		return this.accounts.account(authContext.organizationId);
	}

	@Get('events')
	@ApiOperation({
		summary:
			'List the escrow events the active organization took part in, newest first',
		operationId: 'listEscrowEvents',
	})
	@ApiResponse({ status: HttpStatus.OK, type: EscrowEventPageDto })
	@RequiredAnyOrganizationPermissions({
		billing: ['read'],
		payouts: ['read'],
	})
	async events(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListEscrowEventsQueryDto
	): Promise<EscrowEventPageDto> {
		const granted = await this.organizationAccess.grantedToContext(
			authContext,
			ESCROW_EVENT_PARTIES.map((party) => ESCROW_EVENT_READ_PERMISSION[party])
		);
		const parties = ESCROW_EVENT_PARTIES.filter((party) =>
			granted.some(
				({ resource, action }) =>
					resource === ESCROW_EVENT_READ_PERMISSION[party].resource &&
					action === ESCROW_EVENT_READ_PERMISSION[party].action
			)
		);
		return this.accounts.events(authContext.organizationId, parties, query);
	}
}
