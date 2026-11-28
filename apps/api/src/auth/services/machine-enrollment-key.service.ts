/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { API_KEY_ERROR_CODES } from '@better-auth/api-key';
import { LockMode, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { OrganizationService } from '../../organization/services/organization.service';
import type { Auth } from '../better-auth/better-auth.config';
import { InjectBetterAuth } from '../better-auth/better-auth.provider';
import { API_KEY_CONFIG_ID } from '../constants/api-key.constants';
import { AuthEvents } from '../constants/auth-events.constants';
import {
	MACHINE_ENROLLMENT_KEY_LIST_MAX,
	MACHINE_ENROLLMENT_KEY_PERMISSIONS,
	MachineEnrollmentKeyErrorCode,
} from '../constants/machine-enrollment-key.constants';
import { ApiKey } from '../entities/api-key.entity';
import { ApiKeyRevokedEvent } from '../events/api-key-revoked.event';
import {
	API_KEY_CREATOR_FIELD,
	API_KEY_SINGLE_USE_FIELD,
	apiKeySingleUse,
} from '../utils/api-key-metadata.util';

interface MachineEnrollmentKeyRequest {
	organizationId: string;
	userId: string;
	name: string;
	singleUse: boolean;
	expiresInSeconds: number;
}

export type CreatedMachineEnrollmentKey = Awaited<
	ReturnType<Auth['api']['createApiKey']>
>;

interface VerifiedMachineEnrollmentKey {
	id: string;
	organizationId: string;
}

function keyInvalid(): UnauthorizedException {
	return new UnauthorizedException({
		code: MachineEnrollmentKeyErrorCode.KEY_INVALID,
		message: 'The enrollment key is invalid, expired or revoked',
	});
}

function keyUsed(): ConflictException {
	return new ConflictException({
		code: MachineEnrollmentKeyErrorCode.KEY_USED,
		message:
			'The enrollment key already enrolled its machine or was disabled; create a new one',
	});
}

@Injectable()
export class MachineEnrollmentKeyService {
	constructor(
		@InjectBetterAuth() private readonly auth: Auth,
		private readonly entityManager: EntityManager,
		private readonly eventEmitter: EventEmitter2,
		private readonly organizations: OrganizationService
	) {}

	create(
		request: MachineEnrollmentKeyRequest
	): Promise<CreatedMachineEnrollmentKey> {
		return this.auth.api.createApiKey({
			body: {
				configId: API_KEY_CONFIG_ID.MACHINE_ENROLLMENT,
				organizationId: request.organizationId,
				userId: request.userId,
				name: request.name,
				expiresIn: request.expiresInSeconds,
				permissions: {
					machine: [...MACHINE_ENROLLMENT_KEY_PERMISSIONS.machine],
				},
				metadata: {
					[API_KEY_CREATOR_FIELD]: request.userId,
					[API_KEY_SINGLE_USE_FIELD]: request.singleUse,
				},
			},
		});
	}

	list(organizationId: string): Promise<ApiKey[]> {
		return this.entityManager.fork().find(
			ApiKey,
			{
				referenceId: organizationId,
				configId: API_KEY_CONFIG_ID.MACHINE_ENROLLMENT,
			},
			{
				orderBy: { createdAt: QueryOrder.DESC },
				limit: MACHINE_ENROLLMENT_KEY_LIST_MAX,
			}
		);
	}

	async revoke(organizationId: string, keyId: string): Promise<void> {
		const deleted = await this.entityManager.fork().nativeDelete(ApiKey, {
			id: keyId,
			referenceId: organizationId,
			configId: API_KEY_CONFIG_ID.MACHINE_ENROLLMENT,
		});
		if (deleted === 0) {
			throw new NotFoundException({
				code: MachineEnrollmentKeyErrorCode.KEY_NOT_FOUND,
				message: 'Enrollment key not found',
			});
		}
		await this.eventEmitter.emitAsync(
			AuthEvents.API_KEY_REVOKED,
			new ApiKeyRevokedEvent(keyId)
		);
	}

	async verify(token: string): Promise<VerifiedMachineEnrollmentKey> {
		const result = await this.auth.api.verifyApiKey({
			body: {
				key: token,
				configId: API_KEY_CONFIG_ID.MACHINE_ENROLLMENT,
				permissions: {
					machine: [...MACHINE_ENROLLMENT_KEY_PERMISSIONS.machine],
				},
			},
		});
		if (result.error?.code === API_KEY_ERROR_CODES.KEY_DISABLED.code) {
			throw keyUsed();
		}
		if (!result.valid || !result.key) throw keyInvalid();
		await this.organizations.assertActive(result.key.referenceId);
		return { id: result.key.id, organizationId: result.key.referenceId };
	}

	async spend(manager: EntityManager, keyId: string): Promise<void> {
		const key = await manager.findOne(
			ApiKey,
			{ id: keyId, configId: API_KEY_CONFIG_ID.MACHINE_ENROLLMENT },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		const now = await databaseNow(manager);
		if (!key || (key.expiresAt !== null && key.expiresAt <= now)) {
			throw keyInvalid();
		}
		if (key.enabled === false) throw keyUsed();
		key.lastRequest = now;
		if (apiKeySingleUse(key.metadata)) key.enabled = false;
		await manager.flush();
	}
}
