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
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Audit } from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../../auth/decorators/allow-auth-methods.decorator';
import { RequireFreshSession } from '../../../auth/decorators/require-fresh-session.decorator';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import { PaymentMethodDto } from '../dto/payment-method.dto';
import { PaymentMethodService } from '../services/payment-method.service';

@Controller('billing/payment-methods')
@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class PaymentMethodController {
	constructor(private readonly paymentMethods: PaymentMethodService) {}

	@Get()
	@ApiOperation({
		summary: 'List the saved cards of the active organization',
		operationId: 'listPaymentMethods',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PaymentMethodDto, isArray: true })
	@RequiredOrganizationPermissions({ billing: ['read'] })
	listPaymentMethods(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<PaymentMethodDto[]> {
		return this.paymentMethods.list(authContext.organizationId);
	}

	@Delete(':paymentMethodId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Detach a saved card; automatic top-ups using it stop',
		operationId: 'deletePaymentMethod',
	})
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@AllowAuthMethods([AuthMethod.SESSION])
	@RequireFreshSession()
	@RequiredOrganizationPermissions({ billing: ['manage'] })
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.BILLING,
		targetIdFromRequest: (request) => request.params.paymentMethodId,
	})
	deletePaymentMethod(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Param('paymentMethodId', ParseUUIDPipe) paymentMethodId: string
	): Promise<void> {
		return this.paymentMethods.delete(
			authContext.organizationId,
			paymentMethodId
		);
	}
}
