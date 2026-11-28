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
import { Audit, TypedRequest } from '../../audit/decorators/audit.decorator';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { CustomHeaders } from '../../common/constants/header.constants';
import { OpenApiTag } from '../../common/constants/openapi.constants';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { IsOrganizationAuthContext } from '../../common/decorators/auth-context.decorator';
import { UrlDto } from '../../common/dto/url.dto';
import type { OrganizationAuthContext } from '../../common/types/organization-auth-context.types';
import { apiError } from '../../common/utils/error/api-error.util';
import { ApiIdempotentRequestService } from '../../idempotency/services/api-idempotent-request.service';
import {
	RequiredAnyOrganizationPermissions,
	RequiredOrganizationPermissions,
} from '../../organization/decorators/required-organization-permissions.decorator';
import { AllowGeneralSnapshots } from '../decorators/allow-general-snapshots.decorator';
import { CreateSnapshotDto } from '../dto/create-snapshot.dto';
import { ListSnapshotsQueryDto } from '../dto/list-snapshots-query.dto';
import { SnapshotPageDto } from '../dto/paginated-snapshots.dto';
import { SnapshotDto } from '../dto/snapshot.dto';
import { SnapshotErrorCode } from '../enums/snapshot-error-code.enum';
import { SnapshotAccessGuard } from '../guards/snapshot-access.guard';
import { SnapshotCreationService } from '../services/creation/snapshot-creation.service';
import { SnapshotService } from '../services/snapshot.service';
import { SnapshotStateService } from '../services/snapshot-state.service';

@Controller('snapshots')
@ApiTags(OpenApiTag.SNAPSHOTS)
@ApiBearerAuth()
@ApiErrorResponse()
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
		description:
			'Registers a snapshot from an image name or a build context and returns it immediately. Poll getSnapshot until its state is active, then create sandboxes from it; build_failed carries the reason in errorReason.',
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
					apiError(
						SnapshotErrorCode.SOURCE_INVALID,
						'Send either an image name or build info, not both. Remove the image name to build from build info.'
					)
				);
			}
			if (createSnapshotDto.entrypoint) {
				throw new BadRequestException(
					apiError(
						SnapshotErrorCode.SOURCE_INVALID,
						'An entrypoint cannot be set when building from build info. Set the entrypoint in the Dockerfile instead.'
					)
				);
			}
		} else if (!createSnapshotDto.imageName) {
			throw new BadRequestException(
				apiError(
					SnapshotErrorCode.SOURCE_INVALID,
					'Send an image name or build info to create a snapshot.'
				)
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
		description: 'Returns the snapshot with its current state.',
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
	@RequiredAnyOrganizationPermissions({
		snapshots: ['read', 'write', 'delete'],
	})
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
		description:
			'Deletes the snapshot so no new sandbox can be created from it.',
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
		description:
			'Lists the snapshots available to the organization, one page at a time.',
		operationId: 'getAllSnapshots',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Paginated list of all snapshots',
		type: SnapshotPageDto,
	})
	@RequiredAnyOrganizationPermissions({
		snapshots: ['read', 'write', 'delete'],
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
		description: 'Returns a URL that serves the build logs of the snapshot.',
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
	@RequiredAnyOrganizationPermissions({
		snapshots: ['read', 'write', 'delete'],
	})
	async getSnapshotBuildLogsUrl(
		@Param('id') snapshotId: string
	): Promise<UrlDto> {
		const snapshot = await this.snapshotService.getSnapshot(snapshotId);

		if (!snapshot.buildInfo) {
			throw new NotFoundException(
				apiError(
					SnapshotErrorCode.BUILD_INFO_NOT_FOUND,
					`Snapshot ${snapshotId} was not built from build info, so it has none.`
				)
			);
		}

		const url = await this.snapshotService.getBuildLogsUrl(snapshot);
		return new UrlDto(url);
	}

	@Post(':id/activate')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Activate a snapshot',
		description:
			'Makes an inactive snapshot available for new sandboxes again.',
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
		description: 'Keeps the snapshot but stops new sandboxes from using it.',
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
