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
	Headers,
	HttpStatus,
	Query,
	Req,
	Res,
} from '@nestjs/common';
import {
	ApiHeader,
	ApiOperation,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { IsMachineAuthContext } from '../../common/decorators/auth-context.decorator';
import { SessionGuarded } from '../../common/decorators/session-guarded.decorator';
import type { MachineAuthContext } from '../../common/types/machine-auth-context.types';
import { ControlWakeService } from '../../infra/control-wake/services/control-wake.service';
import {
	CONTROL_DOCUMENT_WAIT_QUERY,
	sendControlDocument,
} from '../../infra/control-wake/utils/control-document-long-poll.util';
import { MACHINE_HOST_SETTINGS_WAKE_TOPIC } from '../constants/machine-host-settings.constants';
import { MachineHostSettingsDocumentDto } from '../dto/machine-host-settings.dto';
import { MachineSessionGuard } from '../guards/machine-session.guard';
import { MachineHostSettingsService } from '../services/host-settings/machine-host-settings.service';

const IF_NONE_MATCH_HEADER = 'if-none-match';

@Controller('machines/settings/v1')
@ApiTags(OpenApiTag.MACHINES)
@PublicEndpoint()
@SessionGuarded(MachineSessionGuard)
export class MachineHostSettingsController {
	constructor(
		private readonly settings: MachineHostSettingsService,
		private readonly wakes: ControlWakeService
	) {}

	@Get()
	@ApiHeader({
		name: 'If-None-Match',
		description: 'Digest of the settings document the machine holds',
		required: false,
	})
	@ApiOperation({
		summary: 'Read the settings the host set for this machine in the dashboard',
		operationId: 'getMachineHostSettings',
	})
	@ApiResponse({ status: HttpStatus.OK, type: MachineHostSettingsDocumentDto })
	@ApiResponse({
		status: HttpStatus.NOT_MODIFIED,
		description: 'Nothing changed',
	})
	@ApiResponse({
		status: HttpStatus.SERVICE_UNAVAILABLE,
		description: 'The API is shutting down; retry after the advertised delay',
	})
	@ApiQuery(CONTROL_DOCUMENT_WAIT_QUERY)
	getSettings(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Headers(IF_NONE_MATCH_HEADER) ifNoneMatch: string | undefined,
		@Query(CONTROL_DOCUMENT_WAIT_QUERY.name)
		requestedWaitSeconds: string | undefined,
		@Req() request: Request,
		@Res() response: Response
	): Promise<void> {
		return sendControlDocument(response, {
			wakes: this.wakes,
			topic: MACHINE_HOST_SETTINGS_WAKE_TOPIC,
			subjectId: machineContext.machineId,
			ifNoneMatch,
			requestedWaitSeconds,
			unavailableMessage: 'Machine settings polling is temporarily unavailable',
			build: () => this.settings.document(machineContext.machineId, request.ip),
		});
	}
}
