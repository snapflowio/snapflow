/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import type { CursorPage } from '../../common/dto/cursor-page.dto';
import type { HumanPrincipal } from '../../common/types/platform-principal.types';
import { isUniqueViolation } from '../../common/utils/error/database-error.util';
import { findCursorPage } from '../../common/utils/pagination/cursor-page.util';
import { tenantScopedRelationKey } from '../../infra/database/utils/composite-relation-key.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SandboxDesiredState } from '../../sandbox/enums/sandbox-desired-state.enum';
import {
	SECRET_PROBLEM_CODE,
	SECRET_RESOURCE_VERSION_INITIAL,
} from '../constants/secret.constants';
import {
	CreateSecretDto,
	CreateSecretVersionDto,
	SecretDto,
	SecretVersionDto,
	UpdateSecretDto,
} from '../dto/secret.dto';
import { SandboxSecretBinding } from '../entities/sandbox-secret-binding.entity';
import { Secret } from '../entities/secret.entity';
import { SecretVersion } from '../entities/secret-version.entity';
import { SecretVersionCipherService } from './secret-version-cipher.service';

const DUPLICATE_SECRET_NAME_MESSAGE = 'A secret with this name already exists';

@Injectable()
export class SecretResourceService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly cipher: SecretVersionCipherService
	) {}

	async list(
		organizationId: string,
		limit: number,
		cursor?: string
	): Promise<CursorPage<SecretDto>> {
		const page = await findCursorPage(this.entityManager, Secret, {
			where: { organizationId },
			orderBy: { normalizedName: 'ASC', id: 'ASC' },
			limit,
			cursor,
		});
		return { ...page, items: page.items.map(SecretDto.from) };
	}

	findOne(organizationId: string, secretId: string): Promise<Secret> {
		return this.requireSecret(this.entityManager, organizationId, secretId);
	}

	async create(
		organizationId: string,
		principal: HumanPrincipal,
		input: CreateSecretDto,
		manager: EntityManager
	): Promise<Secret> {
		const now = await databaseNow(manager);

		const secret = new Secret();
		secret.id = v4();
		secret.organizationId = organizationId;
		secret.name = input.name.trim();
		secret.normalizedName = this.normalizeName(input.name);
		secret.description = input.description?.trim() || null;
		secret.currentVersion = SECRET_RESOURCE_VERSION_INITIAL;
		secret.resourceVersion = SECRET_RESOURCE_VERSION_INITIAL;
		secret.createdByPrincipalType = principal.type;
		secret.createdByPrincipalId = principal.id;
		secret.createdAt = now;
		secret.updatedAt = now;

		const version = this.cipher.encryptVersion({
			organizationId,
			secretId: secret.id,
			versionNumber: SECRET_RESOURCE_VERSION_INITIAL,
			value: input.value,
			principal,
			createdAt: now,
		});
		try {
			manager.persist([secret, version]);
			await manager.flush();
		} catch (error) {
			this.rethrowDuplicateName(error);
		}
		return secret;
	}

	async update(
		organizationId: string,
		secretId: string,
		expectedVersion: number,
		input: UpdateSecretDto
	): Promise<Secret> {
		try {
			return await this.entityManager.transactional(
				async (manager) => {
					const lockedSecret = await this.requireSecretForUpdate(
						manager,
						organizationId,
						secretId
					);
					this.assertVersion(lockedSecret, expectedVersion);
					if (input.name !== undefined) {
						lockedSecret.name = input.name.trim();
						lockedSecret.normalizedName = this.normalizeName(input.name);
					}
					if (input.description !== undefined) {
						lockedSecret.description = input.description.trim() || null;
					}
					lockedSecret.resourceVersion += 1;
					return lockedSecret;
				},
				{ propagation: TransactionPropagation.REQUIRED }
			);
		} catch (error) {
			this.rethrowDuplicateName(error);
		}
	}

	async listVersions(
		organizationId: string,
		secretId: string,
		limit: number,
		cursor?: string
	): Promise<CursorPage<SecretVersionDto>> {
		await this.requireSecret(this.entityManager, organizationId, secretId);
		const page = await findCursorPage(this.entityManager, SecretVersion, {
			where: {
				organizationId,
				secretId: tenantScopedRelationKey(secretId, organizationId),
			},
			orderBy: { version: 'DESC', id: 'DESC' },
			limit,
			cursor,
		});
		return { ...page, items: page.items.map(SecretVersionDto.from) };
	}

	async createVersion(
		organizationId: string,
		secretId: string,
		principal: HumanPrincipal,
		input: CreateSecretVersionDto,
		manager: EntityManager
	): Promise<SecretVersion> {
		const secret = await this.requireSecretForUpdate(
			manager,
			organizationId,
			secretId
		);
		const now = await databaseNow(manager);
		const nextVersion = secret.currentVersion + 1;
		const version = this.cipher.encryptVersion({
			organizationId,
			secretId: secret.id,
			versionNumber: nextVersion,
			value: input.value,
			principal,
			createdAt: now,
		});
		manager.persist(version);
		secret.currentVersion = nextVersion;
		secret.resourceVersion += 1;
		return version;
	}

	async revokeVersion(
		organizationId: string,
		secretId: string,
		versionNumber: number,
		expectedVersion: number
	): Promise<SecretVersion> {
		return this.entityManager.transactional(
			async (manager) => {
				const secret = await this.requireSecretForUpdate(
					manager,
					organizationId,
					secretId
				);
				this.assertVersion(secret, expectedVersion);
				if (secret.currentVersion === versionNumber) {
					throw new UnprocessableEntityException({
						code: SECRET_PROBLEM_CODE.CURRENT_VERSION_REVOKE_DENIED,
						message: 'The current secret version cannot be revoked',
					});
				}
				const lockedVersion = await manager.findOne(
					SecretVersion,
					{
						organizationId,
						secretId: tenantScopedRelationKey(secretId, organizationId),
						version: versionNumber,
					},
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				if (!lockedVersion)
					throw new NotFoundException({
						code: SECRET_PROBLEM_CODE.VERSION_NOT_FOUND,
					});
				if (!lockedVersion.revokedAt) {
					lockedVersion.revokedAt = await databaseNow(manager);
					lockedVersion.resourceVersion += 1;
				}
				secret.resourceVersion += 1;
				return lockedVersion;
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async delete(
		organizationId: string,
		secretId: string,
		expectedVersion: number
	): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const secret = await this.requireSecretForUpdate(
					manager,
					organizationId,
					secretId
				);
				this.assertVersion(secret, expectedVersion);
				if (
					await this.hasActiveSandboxBinding(manager, organizationId, secretId)
				) {
					throw new ConflictException({
						code: SECRET_PROBLEM_CODE.IN_USE,
						message: 'Secret is referenced by a non-destroyed sandbox',
					});
				}
				await manager.nativeDelete(SandboxSecretBinding, {
					organizationId,
					secretId: tenantScopedRelationKey(secretId, organizationId),
				});
				await manager.nativeDelete(SecretVersion, {
					organizationId,
					secretId: tenantScopedRelationKey(secretId, organizationId),
				});
				manager.remove(secret);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	private async hasActiveSandboxBinding(
		manager: EntityManager,
		organizationId: string,
		secretId: string
	): Promise<boolean> {
		const rows = await manager.execute<{ exists: boolean }[]>(
			`select exists (
				select 1
				from "sandbox_secret_binding" as "binding"
				inner join "sandbox" on "sandbox"."id" = "binding"."sandboxId"
				where "binding"."organizationId" = ?
					and "binding"."secretId" = ?
					and "sandbox"."desiredState" <> ?
			) as "exists"`,
			[organizationId, secretId, SandboxDesiredState.DESTROYED]
		);
		return rows[0]?.exists ?? false;
	}

	private async requireSecret(
		manager: EntityManager,
		organizationId: string,
		secretId: string
	): Promise<Secret> {
		const secret = await manager.findOne(Secret, {
			id: secretId,
			organizationId,
		});
		if (!secret)
			throw new NotFoundException({ code: SECRET_PROBLEM_CODE.NOT_FOUND });
		return secret;
	}

	private async requireSecretForUpdate(
		manager: EntityManager,
		organizationId: string,
		secretId: string
	): Promise<Secret> {
		const secret = await manager.findOne(
			Secret,
			{ id: secretId, organizationId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!secret)
			throw new NotFoundException({ code: SECRET_PROBLEM_CODE.NOT_FOUND });
		return secret;
	}

	private assertVersion(secret: Secret, expectedVersion: number): void {
		if (secret.resourceVersion !== expectedVersion) {
			throw new ConflictException({
				code: SECRET_PROBLEM_CODE.VERSION_CONFLICT,
				message: 'Secret was modified by another request',
				currentVersion: secret.resourceVersion,
			});
		}
	}

	private normalizeName(name: string): string {
		return name.trim().normalize('NFKC').toLocaleLowerCase('en-US');
	}

	private rethrowDuplicateName(error: unknown): never {
		if (isUniqueViolation(error)) {
			throw new ConflictException(DUPLICATE_SECRET_NAME_MESSAGE);
		}
		throw error;
	}
}
