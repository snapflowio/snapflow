/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DMCA_RESTORATION } from '../../abuse/constants/abuse-report.constants';
import { enabledSocialProviders } from '../../auth/better-auth/plugins/social-providers';
import { HUMAN_VERIFICATION_ACTION } from '../../auth/constants/auth-paths.constants';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { LEGAL_DOCUMENT_VERSION } from '../../legal/constants/legal-documents.constants';
import { AvailableInMaintenance } from '../../settings/guards/maintenance.guard';
import { PublicConfigDto } from '../dto/public-config.dto';

@Controller('public-config')
@ApiTags(OpenApiTag.PUBLIC_CONFIGURATION)
@PublicEndpoint()
@AvailableInMaintenance()
export class PublicConfigController {
	constructor(private readonly config: TypedConfigService) {}

	@Get()
	@ApiOperation({
		summary: 'Get the public configuration of the dashboard',
		operationId: 'getPublicConfig',
	})
	@ApiResponse({ status: HttpStatus.OK, type: PublicConfigDto })
	get(): PublicConfigDto {
		return {
			analytics: this.config.get('analytics'),
			humanVerification: {
				siteKey: this.config.get('humanVerification.siteKey'),
				action: HUMAN_VERIFICATION_ACTION,
			},
			websiteUrl: this.config.getOrThrow('websiteUrl'),
			legal: {
				termsVersion: LEGAL_DOCUMENT_VERSION.TERMS,
				hostTermsVersion: LEGAL_DOCUMENT_VERSION.HOST_TERMS,
				dmcaRestoreAfterBusinessDays: DMCA_RESTORATION.minimumBusinessDays,
				dmcaRestoreByBusinessDays: DMCA_RESTORATION.maximumBusinessDays,
			},
			passkeyRpId: this.config.getOrThrow('passkeyRpId'),
			receiptsAvailable: this.config.get('receipts.issuer') !== null,
			socialProviders: enabledSocialProviders(this.config),
			settlement: {
				chainId: this.config.get('settlement.chainId'),
				escrowAddress: this.config.get('settlement.escrowAddress'),
				usdcAddress: this.config.get('settlement.usdcAddress'),
				feeReceiverAddress: this.config.get('settlement.feeReceiverAddress'),
				walletConnectProjectId: this.config.get(
					'settlement.walletConnectProjectId'
				),
			},
		};
	}
}
