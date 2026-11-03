/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import {
	Controller,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Post,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
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
import { AuthenticatedRateLimitGuard } from '../../../common/guards/authenticated-rate-limit.guard';
import { RequiredSystemRole } from '../../../user/decorators/required-system-role.decorator';
import { SystemRole } from '../../../user/enums/system-role.enum';
import { SandboxDto } from '../dto/sandbox.dto';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxRecoveryService } from '../services/lifecycle/sandbox-recovery.service';

@Controller('admin/sandbox')
@ApiTags('admin')
@ApiBearerAuth()
@AllowAuthMethods([AuthMethod.SESSION])
@RequiredSystemRole(SystemRole.ADMIN)
@UseGuards(AuthenticatedRateLimitGuard)
export class AdminSandboxController {
	constructor(
		private readonly recovery: SandboxRecoveryService,
		private readonly entityManager: EntityManager
	) {}

	@Post(':sandboxId/recover')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Recover sandbox from error state as an admin',
		operationId: 'adminRecoverSandbox',
	})
	@ApiParam({
		name: 'sandboxId',
		description: 'ID of the sandbox',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Recovery initiated',
		type: SandboxDto,
	})
	@Audit({
		action: AuditAction.RECOVER,
		targetType: AuditTarget.SANDBOX,
		targetIdFromRequest: (req) => req.params.sandboxId,
		targetIdFromResult: (result: SandboxDto) => result?.id,
	})
	async recoverSandbox(
		@Param('sandboxId') sandboxId: string
	): Promise<SandboxDto> {
		const sandbox = await this.entityManager.findOne(
			Sandbox,
			{ id: sandboxId },
			{ fields: ['organizationId'], disableIdentityMap: true }
		);
		if (!sandbox) {
			throw new NotFoundException('Sandbox not found');
		}
		const recoveredSandbox = await this.recovery.recover(
			sandboxId,
			sandbox.organizationId
		);
		return SandboxDto.from(recoveredSandbox);
	}
}
