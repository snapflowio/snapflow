/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Controller,
	Get,
	HttpStatus,
	ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { apiError } from '../../common/utils/error/api-error.util';
import { OrganizationOwnershipService } from '../../organization/services/organization-ownership.service';
import { HeldFundsErrorCode } from '../../settlement/constants/held-funds.constants';
import { HeldFundsService } from '../../settlement/services/funds/held-funds.service';
import { isChainUnreachable } from '../../settlement/utils/chain-error.util';
import {
	ACCOUNT_FUNDS_UNREADABLE_MESSAGE,
	accountDeletionBlockers,
} from '../better-auth/account/account-deletion';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../decorators/allow-auth-methods.decorator';
import { AccountDeletionBlockersDto } from '../dto/deletion-blockers.dto';

@Controller('users/me')
@ApiTags(OpenApiTag.USERS)
@AllowAuthMethods([AuthMethod.SESSION])
export class AccountDeletionController {
	constructor(
		private readonly ownership: OrganizationOwnershipService,
		private readonly heldFunds: HeldFundsService
	) {}

	@Get('deletion-blockers')
	@ApiOperation({
		summary: 'List what blocks deleting the signed-in account',
		operationId: 'getAccountDeletionBlockers',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description:
			'Organizations, resources and funds to resolve before the account can be deleted',
		type: AccountDeletionBlockersDto,
	})
	async getDeletionBlockers(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<AccountDeletionBlockersDto> {
		try {
			return await accountDeletionBlockers(
				{ ownership: this.ownership, heldFunds: this.heldFunds },
				authContext.userId
			);
		} catch (error) {
			if (!isChainUnreachable(error)) throw error;
			throw new ServiceUnavailableException(
				apiError(
					HeldFundsErrorCode.FUNDS_UNREADABLE,
					ACCOUNT_FUNDS_UNREADABLE_MESSAGE
				)
			);
		}
	}
}
