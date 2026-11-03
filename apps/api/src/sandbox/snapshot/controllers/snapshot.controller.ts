/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Res,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiHeader,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
	Audit,
	TypedRequest,
} from '../../../audit/log/decorators/audit.decorator';
import { AuditAction } from '../../../audit/log/enums/audit-action.enum';
import { AuditTarget } from '../../../audit/log/enums/audit-target.enum';
import { CustomHeaders } from '../../../common/constants/header.constants';
import { IsOrganizationAuthContext } from '../../../common/decorators/auth-context.decorator';
import { UrlDto } from '../../../common/dto/url.dto';
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import type { OrganizationAuthContext } from '../../../common/types/organization-auth-context.types';
import { ApiIdempotentRequestService } from '../../../idempotency/request/services/api-idempotent-request.service';
import { RequiredOrganizationPermissions } from '../../../organization/tenant/decorators/required-organization-permissions.decorator';
import { AllowGeneralSnapshots } from '../decorators/allow-general-snapshots.decorator';
import { CreateSnapshotDto } from '../dto/create-snapshot.dto';
import { ListSnapshotsQueryDto } from '../dto/list-snapshots-query.dto';
import { SnapshotPageDto } from '../dto/paginated-snapshots.dto';
import { SnapshotDto } from '../dto/snapshot.dto';
import { SnapshotAccessGuard } from '../guards/snapshot-access.guard';
import { SnapshotService } from '../services/snapshot.service';
import { SnapshotCreationService } from '../services/snapshot-creation.service';
import { SnapshotStateService } from '../services/snapshot-state.service';

@Controller('snapshots')
@ApiTags('snapshots')
@ApiBearerAuth()
@UseGuards(AuthenticatedRateLimitGuard)
export class SnapshotController {
	constructor(
		private readonly snapshotService: SnapshotService,
		private readonly snapshotCreation: SnapshotCreationService,
		private readonly snapshotState: SnapshotStateService,
		private readonly idempotency: ApiIdempotentRequestService
	) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiHeader(CustomHeaders.IDEMPOTENCY_KEY)
	@ApiOperation({
		summary: 'Create a new snapshot',
		operationId: 'createSnapshot',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The snapshot has been successfully created.',
		type: SnapshotDto,
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Bad request - Snapshots with tag ":latest" are not allowed',
	})
	@RequiredOrganizationPermissions({ snapshots: ['write'] })
	@Audit({
		action: AuditAction.CREATE,
		targetType: AuditTarget.SNAPSHOT,
		targetIdFromResult: (result: SnapshotDto) => result?.id,
		requestMetadata: {
			body: (req: TypedRequest<CreateSnapshotDto>) => ({
				name: req.body?.name,
				imageName: req.body?.imageName,
				entrypoint: req.body?.entrypoint,
				cpu: req.body?.cpu,
				memory: req.body?.memory,
				disk: req.body?.disk,
				gpu: req.body?.gpu,
				gpuType: req.body?.gpuType,
				buildInfo: req.body?.buildInfo,
				sandboxClass: req.body?.sandboxClass,
			}),
		},
	})
	async createSnapshot(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Headers(CustomHeaders.IDEMPOTENCY_KEY.name) key: string,
		@Body() createSnapshotDto: CreateSnapshotDto,
		@Res({ passthrough: true }) response: Response
	): Promise<SnapshotDto> {
		if (createSnapshotDto.buildInfo) {
			if (createSnapshotDto.imageName) {
				throw new BadRequestException(
					'Cannot specify an image name when using a build info entry'
				);
			}
			if (createSnapshotDto.entrypoint) {
				throw new BadRequestException(
					'Cannot specify an entrypoint when using a build info entry'
				);
			}
		} else if (!createSnapshotDto.imageName) {
			throw new BadRequestException(
				'Must specify an image name when not using a build info entry'
			);
		}

		const result = await this.idempotency.execute(
			{
				key,
				organizationId: authContext.organizationId,
				principal: authContext.principal,
				method: 'POST',
				routeTemplate: '/snapshots',
				fingerprintInput: createSnapshotDto,
			},
			async () => {
				const snapshot = createSnapshotDto.buildInfo
					? await this.snapshotCreation.createFromBuildInfo(
							authContext.organizationId,
							createSnapshotDto
						)
					: await this.snapshotCreation.createFromPull(
							authContext.organizationId,
							createSnapshotDto
						);
				return {
					body: SnapshotDto.from(snapshot),
					status: HttpStatus.OK,
					resource: { type: AuditTarget.SNAPSHOT, id: snapshot.id },
				};
			}
		);
		if (result.replayed) {
			response.setHeader(CustomHeaders.IDEMPOTENCY_REPLAYED.name, 'true');
		}
		return result.body;
	}

	@Get(':id')
	@ApiOperation({
		summary: 'Get snapshot by ID or name',
		operationId: 'getSnapshot',
	})
	@ApiParam({
		name: 'id',
		description: 'Snapshot ID or name',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The snapshot',
		type: SnapshotDto,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Snapshot not found',
	})
	@UseGuards(SnapshotAccessGuard)
	@AllowGeneralSnapshots()
	async getSnapshot(
		@Param('id') snapshotIdOrName: string,
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<SnapshotDto> {
		const snapshot = await this.snapshotService.findAccessibleSnapshot(
			snapshotIdOrName,
			authContext.organizationId
		);
		return SnapshotDto.from(snapshot);
	}

	@Delete(':id')
	@ApiOperation({
		summary: 'Delete snapshot',
		operationId: 'removeSnapshot',
	})
	@ApiParam({
		name: 'id',
		description: 'Snapshot ID',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Snapshot has been deleted',
	})
	@UseGuards(SnapshotAccessGuard)
	@RequiredOrganizationPermissions({ snapshots: ['delete'] })
	@Audit({
		action: AuditAction.DELETE,
		targetType: AuditTarget.SNAPSHOT,
		targetIdFromRequest: (req) => req.params.id,
	})
	async removeSnapshot(
		@Param('id', ParseUUIDPipe) snapshotId: string
	): Promise<void> {
		await this.snapshotService.removeSnapshot(snapshotId);
	}

	@Get()
	@ApiOperation({
		summary: 'List all snapshots',
		operationId: 'getAllSnapshots',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Paginated list of all snapshots',
		type: SnapshotPageDto,
	})
	async getAllSnapshots(
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext,
		@Query() queryParams: ListSnapshotsQueryDto
	): Promise<SnapshotPageDto> {
		const { cursor, limit, name, sort, order } = queryParams;

		const result = await this.snapshotService.getAllSnapshots(
			authContext.organizationId,
			limit,
			cursor,
			{ name },
			{ field: sort, direction: order }
		);

		return {
			...result,
			items: result.items.map(SnapshotDto.from),
		};
	}

	@Get(':id/build-logs-url')
	@ApiOperation({
		summary: 'Get snapshot build logs URL',
		operationId: 'getSnapshotBuildLogsUrl',
	})
	@ApiParam({
		name: 'id',
		description: 'Snapshot ID',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The snapshot build logs URL',
		type: UrlDto,
	})
	@UseGuards(SnapshotAccessGuard)
	async getSnapshotBuildLogsUrl(
		@Param('id') snapshotId: string
	): Promise<UrlDto> {
		const snapshot = await this.snapshotService.getSnapshot(snapshotId);

		if (!snapshot.buildInfo) {
			throw new NotFoundException(`Snapshot ${snapshotId} has no build info`);
		}

		const url = await this.snapshotService.getBuildLogsUrl(snapshot);
		return new UrlDto(url);
	}

	@Post(':id/activate')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Activate a snapshot',
		operationId: 'activateSnapshot',
	})
	@ApiParam({
		name: 'id',
		description: 'Snapshot ID',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The snapshot has been successfully activated.',
		type: SnapshotDto,
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Bad request - Snapshot is already active, not in inactive state, or has associated snapshot machines',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Snapshot not found',
	})
	@UseGuards(SnapshotAccessGuard)
	@RequiredOrganizationPermissions({ snapshots: ['write'] })
	@Audit({
		action: AuditAction.ACTIVATE,
		targetType: AuditTarget.SNAPSHOT,
		targetIdFromRequest: (req) => req.params.id,
	})
	async activateSnapshot(
		@Param('id', ParseUUIDPipe) snapshotId: string,
		@IsOrganizationAuthContext() authContext: OrganizationAuthContext
	): Promise<SnapshotDto> {
		const snapshot = await this.snapshotState.activateSnapshot(
			snapshotId,
			authContext.organizationId
		);
		return SnapshotDto.from(snapshot);
	}

	@Post(':id/deactivate')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Deactivate a snapshot',
		operationId: 'deactivateSnapshot',
	})
	@ApiParam({
		name: 'id',
		description: 'Snapshot ID',
	})
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The snapshot has been successfully deactivated.',
	})
	@UseGuards(SnapshotAccessGuard)
	@RequiredOrganizationPermissions({ snapshots: ['write'] })
	@Audit({
		action: AuditAction.DEACTIVATE,
		targetType: AuditTarget.SNAPSHOT,
		targetIdFromRequest: (req) => req.params.id,
	})
	async deactivateSnapshot(@Param('id', ParseUUIDPipe) snapshotId: string) {
		await this.snapshotState.deactivateSnapshot(snapshotId);
	}
}
