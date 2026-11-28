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
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Audit, TypedRequest } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../auth/decorators/allow-auth-methods.decorator';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { RequiredSystemRole } from '../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../user/enums/system-role.enum';
import { SnapshotDto } from '../dto/snapshot.dto';
import { SetSnapshotGeneralStatusDto } from '../dto/update-snapshot.dto';
import { SnapshotService } from '../services/snapshot.service';

@Controller('admin/snapshots')
@ApiTags(OpenApiTag.ADMIN)
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
export class AdminSnapshotController {
	constructor(private readonly snapshotService: SnapshotService) {}

	@Patch(':id/general')
	@ApiOperation({
		summary: 'Set snapshot general status',
		operationId: 'adminSetSnapshotGeneralStatus',
	})
	@ApiParam({
		name: 'id',
		description: 'Snapshot ID',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Snapshot general status has been set',
		type: SnapshotDto,
	})
	@Audit({
		action: AuditAction.SET_GENERAL_STATUS,
		targetType: AuditTarget.SNAPSHOT,
		targetIdFromRequest: (req) => req.params.id,
		requestMetadata: {
			body: (req: TypedRequest<SetSnapshotGeneralStatusDto>) => ({
				general: req.body?.general,
			}),
		},
	})
	async setSnapshotGeneralStatus(
		@Param('id', ParseUUIDPipe) snapshotId: string,
		@Body() dto: SetSnapshotGeneralStatusDto
	): Promise<SnapshotDto> {
		const snapshot = await this.snapshotService.setSnapshotGeneralStatus(
			snapshotId,
			dto.general
		);
		return SnapshotDto.from(snapshot);
	}
}
