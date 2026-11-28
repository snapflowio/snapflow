/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Body, Controller, Get, HttpStatus, Put, Query } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	Audit,
	type TypedRequest,
} from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { TermsAcceptanceExempt } from '../../legal/decorators/terms-acceptance-exempt.decorator';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import { AutoTopUpDto, UpdateAutoTopUpDto } from '../dto/auto-top-up.dto';
import {
	EscrowAccountDto,
	EscrowEventPageDto,
	ListEscrowEventsQueryDto,
} from '../dto/escrow.dto';
import { EscrowPendingChangesDto } from '../dto/escrow-pending.dto';
import { HostEscrowBalanceDto } from '../dto/host-earnings.dto';
import {
	HostPayoutPageDto,
	ListHostPayoutsQueryDto,
} from '../dto/host-payout.dto';
import { AutoTopUpService } from '../services/auto-top-up/auto-top-up.service';
import { EscrowAccountService } from '../services/escrow/escrow-account.service';
import { EscrowPendingService } from '../services/escrow/escrow-pending.service';
import { HostEarningsService } from '../services/payouts/host-earnings.service';
import { HostPayoutHistoryService } from '../services/payouts/host-payout-history.service';
import { SettlementPartyAccessService } from '../services/settlement-party-access.service';

@Controller('settlement')
@ApiTags(OpenApiTag.SETTLEMENT)
@ApiBearerAuth()
export class EscrowController {
	constructor(
		private readonly accounts: EscrowAccountService,
		private readonly hostEarnings: HostEarningsService,
		private readonly partyAccess: SettlementPartyAccessService,
		private readonly autoTopUps: AutoTopUpService,
		private readonly pendingChanges: EscrowPendingService,
		private readonly payoutHistory: HostPayoutHistoryService
	) {}

	@Get('escrow/auto-top-up')
	@ApiOperation({
		summary:
			"Get the active organization's auto top-up settings, on-chain limits and status",
		operationId: 'getAutoTopUp',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AutoTopUpDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	autoTopUp(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<AutoTopUpDto> {
		return this.autoTopUps.get(authContext.organizationId);
	}

	@Put('escrow/auto-top-up')
	@TermsAcceptanceExempt(
		({ body }: TypedRequest<UpdateAutoTopUpDto>) => body?.enabled === false
	)
	@ApiOperation({
		summary:
			"Set the active organization's auto top-up terms and turn it on or off. The funding wallet then sends setAutoTopUp(relayerAddress, amount, threshold, maxRelayFee, minInterval) with them; once it has, Snapflow's relayer pulls the amount whenever the escrow balance falls below the threshold, at most timesPerDay times a day",
		operationId: 'updateAutoTopUp',
	})
	@ApiResponse({ status: HttpStatus.OK, type: AutoTopUpDto })
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	@Audit({ action: AuditAction.UPDATE, targetType: AuditTarget.BILLING })
	@AllowAuthMethods([AuthMethod.SESSION])
	updateAutoTopUp(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Body() input: UpdateAutoTopUpDto
	): Promise<AutoTopUpDto> {
		return this.autoTopUps.update(authContext.organizationId, input);
	}

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

	@Get('escrow/pending')
	@ApiOperation({
		summary:
			"List the deposits and withdrawal changes of the active organization's funding wallet that are on chain and not in its balance yet",
		operationId: 'getEscrowPendingChanges',
	})
	@ApiResponse({ status: HttpStatus.OK, type: EscrowPendingChangesDto })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	pending(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<EscrowPendingChangesDto> {
		return this.pendingChanges.changes(authContext.organizationId);
	}

	@Get('host/payouts')
	@ApiOperation({
		summary:
			"List the payouts of the active organization's machines, newest first, each with the claims it paid out",
		operationId: 'listHostPayouts',
	})
	@ApiResponse({ status: HttpStatus.OK, type: HostPayoutPageDto })
	@RequiredOrganizationPermissions({ payouts: ['read'] })
	hostPayouts(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() query: ListHostPayoutsQueryDto
	): Promise<HostPayoutPageDto> {
		return this.payoutHistory.list(authContext.organizationId, query);
	}

	@Get('host')
	@ApiOperation({
		summary:
			"Get the active organization's escrow earnings, summed over its machines' host keys and listed per key",
		operationId: 'getHostEscrowBalance',
	})
	@ApiResponse({ status: HttpStatus.OK, type: HostEscrowBalanceDto })
	@RequiredOrganizationPermissions({ payouts: ['read'] })
	hostBalance(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<HostEscrowBalanceDto> {
		return this.hostEarnings.forOrganization(authContext.organizationId);
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
		return this.accounts.events(
			authContext.organizationId,
			await this.partyAccess.readableParties(authContext, query.role),
			query
		);
	}
}
