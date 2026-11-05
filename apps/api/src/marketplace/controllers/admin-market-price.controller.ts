/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	Put,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
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
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';
import {
	MarketReferencePriceDto,
	UpdateMarketReferencePriceDto,
} from '../dto/market-reference-price.dto';
import { PriceFloorService } from '../services/price-floor.service';

@Controller('admin/market-reference-prices')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminMarketPriceController {
	constructor(private readonly floors: PriceFloorService) {}

	@Get()
	@ApiOperation({
		summary: 'List the market reference prices of every price class',
		operationId: 'listMarketReferencePrices',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		type: MarketReferencePriceDto,
		isArray: true,
	})
	listMarketReferencePrices(): Promise<MarketReferencePriceDto[]> {
		return this.floors.listReferencePrices();
	}

	@Put(':priceClass')
	@ApiOperation({
		summary: 'Set the bootstrap median of a price class',
		operationId: 'updateMarketReferencePrice',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MarketReferencePriceDto })
	@Audit({
		action: AuditAction.UPDATE,
		targetType: AuditTarget.MARKET_REFERENCE_PRICE,
		targetIdFromRequest: (request: Request) => request.params.priceClass,
		requestMetadata: {
			body: (request: TypedRequest<UpdateMarketReferencePriceDto>) => ({
				bootstrapMedianMicroUsd: request.body.bootstrapMedianMicroUsd,
			}),
		},
	})
	updateMarketReferencePrice(
		@IsOrganizationAuthContext() context: OrganizationAuthContext,
		@Param('priceClass') priceClass: string,
		@Body() input: UpdateMarketReferencePriceDto
	): Promise<MarketReferencePriceDto> {
		return this.floors.updateBootstrapMedian(priceClass, input, context.userId);
	}
}
