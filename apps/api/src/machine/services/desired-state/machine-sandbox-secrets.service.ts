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
	ConflictException,
	Injectable,
	UnprocessableEntityException,
} from '@nestjs/common';
import { SandboxLifecycle } from '@snapflow/machine-proto';
import { apiError } from '../../../common/utils/error/api-error.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { Sandbox } from '../../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../../sandbox/entities/sandbox-placement.entity';
import { SandboxNotFoundException } from '../../../sandbox/exceptions/sandbox-not-found.exception';
import {
	clearEnvironment,
	MachineSandboxSecretDeliveryService,
} from '../../../secrets/services/machine-sandbox-secret-delivery.service';
import type {
	MachineSandboxSecretsDto,
	MachineSandboxSecretsQueryDto,
} from '../../dto/machine-sandbox-control.dto';
import type { MachineSession } from '../../entities/machine-session.entity';
import { MachineApiErrorCode } from '../../enums/machine-api-error-code.enum';
import { encodeSandboxSecrets } from '../../utils/proto/sandbox-secrets.util';
import { MachineSessionService } from '../connection/machine-session.service';

const SECRET_DELIVERY_FAILURE_MESSAGE =
	'A required platform secret could not be delivered. Retry later; the sandbox stays stopped until it is delivered.';

@Injectable()
export class MachineSandboxSecretsService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessions: MachineSessionService,
		private readonly secretDelivery: MachineSandboxSecretDeliveryService
	) {}

	async deliver(
		machineId: string,
		session: MachineSession,
		sandboxId: string,
		query: MachineSandboxSecretsQueryDto
	): Promise<MachineSandboxSecretsDto> {
		const delivery = await this.entityManager.transactional(async (manager) => {
			const observedAt = await databaseNow(manager);
			await this.machineSessions.assertCurrent(
				manager,
				machineId,
				session.id,
				observedAt
			);
			const sandbox = await manager.findOne(Sandbox, { id: sandboxId });
			if (!sandbox) {
				throw new SandboxNotFoundException(sandboxId);
			}
			const placement = await manager.findOne(SandboxPlacement, {
				sandboxId,
				releasedAt: null,
			});
			if (
				placement?.machineId !== machineId ||
				placement.assignmentGeneration !== query.assignmentGeneration
			) {
				throw new ConflictException(
					apiError(
						MachineApiErrorCode.ASSIGNMENT_STALE,
						'The sandbox is no longer assigned to this machine. Refresh the desired state and stop the sandbox.'
					)
				);
			}
			if (sandbox.specGeneration !== query.specGeneration) {
				throw new ConflictException(
					apiError(
						MachineApiErrorCode.ASSIGNMENT_STALE,
						`Spec generation ${query.specGeneration} is outdated. Refresh the desired state and use the current spec.`
					)
				);
			}
			if (
				sandbox.runtimeLifecycle === null ||
				sandbox.runtimeLifecycle === SandboxLifecycle.DESTROYED
			) {
				throw new ConflictException(
					apiError(
						MachineApiErrorCode.ASSIGNMENT_STALE,
						'The sandbox should not be running. Refresh the desired state and stop the sandbox.'
					)
				);
			}
			return this.secretDelivery.deliverEnvironment(manager, {
				sandbox,
				placement,
				machineSessionId: session.id,
				specGeneration: sandbox.specGeneration,
			});
		});
		if (!delivery.delivered) {
			throw new UnprocessableEntityException(
				apiError(
					MachineApiErrorCode.SECRET_DELIVERY_FAILED,
					SECRET_DELIVERY_FAILURE_MESSAGE
				)
			);
		}
		const { environment } = delivery;
		try {
			return {
				secrets: encodeSandboxSecrets({
					sandboxId,
					assignmentGeneration: query.assignmentGeneration,
					specGeneration: query.specGeneration,
					environment,
				}),
			};
		} finally {
			clearEnvironment(environment);
		}
	}
}
