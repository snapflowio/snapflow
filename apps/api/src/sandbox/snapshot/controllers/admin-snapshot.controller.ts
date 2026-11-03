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
	ParseUUIDPipe,
	Patch,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	Audit,
	TypedRequest,
} from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import {
	AllowAuthMethods,
	AuthMethod,
} from '../../../auth/decorators/allow-auth-methods.decorator';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import { RequiredSystemRole } from '../../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../../user/enums/system-role.enum';
import { SnapshotDto } from '../dto/snapshot.dto';
import { SetSnapshotGeneralStatusDto } from '../dto/update-snapshot.dto';
import { SnapshotService } from '../services/snapshot.service';

@Controller('admin/snapshots')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminSnapshotController {
	constructor(private readonly snapshotService: SnapshotService) {}

	@Get('can-cleanup-image')
	@ApiOperation({
		summary: 'Check if an image can be cleaned up',
		operationId: 'adminCanCleanupImage',
	})
	@ApiQuery({
		name: 'imageName',
		required: true,
		type: String,
		description: 'Image name with tag to check',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Boolean indicating if image can be cleaned up',
		type: Boolean,
	})
	async canCleanupImage(
		@Query('imageName') imageName: string
	): Promise<boolean> {
		return this.snapshotService.canCleanupImage(imageName);
	}

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
