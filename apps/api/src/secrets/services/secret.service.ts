/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, sql } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import type { HumanPrincipal } from '../../common/types/platform-principal.types';
import { tenantScopedRelationKey } from '../../infra/database/utils/composite-relation-key.util';
import { Sandbox } from '../../sandbox/instance/entities/sandbox.entity';
import { SandboxState } from '../../sandbox/instance/enums/sandbox-state.enum';
import {
	SECRET_LIMITS,
	SECRET_PROBLEM_CODE,
	SECRET_RESOURCE_VERSION_INITIAL,
} from '../constants/secret.constants';
import type {
	ReplaceSandboxSecretBindingsDto,
	SandboxSecretBindingSetDto,
	SecretBindingDto,
} from '../dto/secret.dto';
import { SandboxSecretBinding } from '../entities/sandbox-secret-binding.entity';
import { SandboxSecretBindingSet } from '../entities/sandbox-secret-binding-set.entity';
import { Secret } from '../entities/secret.entity';
import { SecretVersion } from '../entities/secret-version.entity';

function secretVersionKey(secretId: string, version: number): string {
	return `${secretId}:${version}`;
}

function bindingSetDto(
	sandboxId: string,
	resourceVersion: number,
	bindings: readonly SandboxSecretBinding[]
): SandboxSecretBindingSetDto {
	return {
		sandboxId,
		resourceVersion,
		bindings: bindings.map((binding) => ({
			name: binding.environmentName,
			secretId: binding.secretId,
			version: binding.secretVersion,
			secretVersionId: binding.secretVersionId,
		})),
	};
}

function assertVersionUsable(
	version: SecretVersion | undefined
): SecretVersion {
	if (!version) {
		throw new NotFoundException({
			code: SECRET_PROBLEM_CODE.VERSION_NOT_FOUND,
		});
	}
	if (version.revokedAt) {
		throw new UnprocessableEntityException({
			code: SECRET_PROBLEM_CODE.VERSION_REVOKED,
		});
	}
	return version;
}

@Injectable()
export class SecretService {
	constructor(private readonly entityManager: EntityManager) {}

	async bindToSandbox(
		manager: EntityManager,
		organizationId: string,
		sandboxId: string,
		ordinaryEnvironment: Readonly<Record<string, string>>,
		bindings: readonly SecretBindingDto[] | undefined,
		principal: HumanPrincipal
	): Promise<void> {
		await this.ensureBindingSet(manager, organizationId, sandboxId);
		await this.createSandboxBindings(
			manager,
			organizationId,
			sandboxId,
			ordinaryEnvironment,
			bindings,
			principal
		);
	}

	async hasSandboxBindings(
		organizationId: string,
		sandboxId: string
	): Promise<boolean> {
		return Boolean(
			await this.entityManager.findOne(
				SandboxSecretBinding,
				{
					organizationId,
					sandboxId: tenantScopedRelationKey(sandboxId, organizationId),
				},
				{ fields: ['id'], disableIdentityMap: true }
			)
		);
	}

	async copySandboxBindings(
		manager: EntityManager,
		organizationId: string,
		sourceSandboxId: string,
		targetSandboxId: string,
		principal: HumanPrincipal
	): Promise<void> {
		await this.ensureBindingSet(manager, organizationId, targetSandboxId);
		const bindings = await manager.find(
			SandboxSecretBinding,
			{
				organizationId,
				sandboxId: tenantScopedRelationKey(sourceSandboxId, organizationId),
			},
			{ orderBy: { environmentName: 'ASC' } }
		);
		if (bindings.length === 0) return;

		const versions = await manager.find(SecretVersion, {
			id: { $in: bindings.map((binding) => binding.secretVersionId) },
			organizationId,
		});
		const versionById = new Map(
			versions.map((version) => [version.id, version])
		);
		const rows = bindings.map((binding) => {
			const candidate = versionById.get(binding.secretVersionId);
			const version = assertVersionUsable(
				candidate?.secretId === binding.secretId &&
					candidate.version === binding.secretVersion
					? candidate
					: undefined
			);
			return this.createBinding(
				targetSandboxId,
				organizationId,
				binding.environmentName,
				binding.secretId,
				version,
				principal
			);
		});
		manager.persist(rows);
	}

	async getSandboxBindings(
		organizationId: string,
		sandboxId: string
	): Promise<SandboxSecretBindingSetDto> {
		const bindingSet = await this.entityManager.findOne(
			SandboxSecretBindingSet,
			{ organizationId, sandboxId }
		);
		if (!bindingSet)
			throw new NotFoundException('Secret binding set not found');
		const bindings = await this.entityManager.find(
			SandboxSecretBinding,
			{
				organizationId,
				sandboxId: tenantScopedRelationKey(sandboxId, organizationId),
			},
			{ orderBy: { environmentName: 'ASC' } }
		);
		return bindingSetDto(sandboxId, bindingSet.resourceVersion, bindings);
	}

	async replaceSandboxBindings(
		manager: EntityManager,
		organizationId: string,
		sandboxId: string,
		expectedVersion: number,
		input: ReplaceSandboxSecretBindingsDto,
		principal: HumanPrincipal
	): Promise<SandboxSecretBindingSetDto> {
		const sandbox = await manager.findOne(
			Sandbox,
			{ id: sandboxId, organizationId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!sandbox) throw new NotFoundException('Sandbox not found');
		if (sandbox.state !== SandboxState.STOPPED || sandbox.pending) {
			throw new ConflictException(
				'Secret bindings can only be replaced while the sandbox is stopped'
			);
		}
		const bindingSet = await manager.findOne(
			SandboxSecretBindingSet,
			{ sandboxId, organizationId },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
		if (!bindingSet)
			throw new NotFoundException('Secret binding set not found');
		if (bindingSet.resourceVersion !== expectedVersion) {
			throw new ConflictException({
				code: SECRET_PROBLEM_CODE.VERSION_CONFLICT,
				message: 'Secret bindings changed before this request was applied',
				currentVersion: bindingSet.resourceVersion,
			});
		}
		await manager.nativeDelete(SandboxSecretBinding, {
			organizationId,
			sandboxId: tenantScopedRelationKey(sandboxId, organizationId),
		});
		const bindings = await this.createSandboxBindings(
			manager,
			organizationId,
			sandboxId,
			sandbox.env ?? {},
			input.bindings,
			principal
		);
		bindingSet.resourceVersion += 1;
		bindings.sort((left, right) =>
			left.environmentName.localeCompare(right.environmentName)
		);
		return bindingSetDto(sandboxId, bindingSet.resourceVersion, bindings);
	}

	private async createSandboxBindings(
		manager: EntityManager,
		organizationId: string,
		sandboxId: string,
		ordinaryEnvironment: Readonly<Record<string, string>>,
		bindings: readonly SecretBindingDto[] | undefined,
		principal: HumanPrincipal
	): Promise<SandboxSecretBinding[]> {
		if (!bindings?.length) return [];
		this.assertBindingNames(ordinaryEnvironment, bindings);
		const secrets = await manager.find(Secret, {
			id: { $in: [...new Set(bindings.map((binding) => binding.secretId))] },
			organizationId,
		});
		const secretById = new Map(secrets.map((secret) => [secret.id, secret]));
		const requests = bindings.map((binding) => {
			const secret = secretById.get(binding.secretId);
			if (!secret) {
				throw new NotFoundException({ code: SECRET_PROBLEM_CODE.NOT_FOUND });
			}
			return {
				binding,
				secret,
				versionNumber: binding.version ?? secret.currentVersion,
			};
		});
		const versions = await manager.find(SecretVersion, {
			organizationId,
			$or: requests.map(({ secret, versionNumber }) => ({
				secretId: tenantScopedRelationKey(secret.id, organizationId),
				version: versionNumber,
			})),
		});
		const versionByKey = new Map(
			versions.map((version) => [
				secretVersionKey(version.secretId, version.version),
				version,
			])
		);
		const rows = requests.map(({ binding, secret, versionNumber }) =>
			this.createBinding(
				sandboxId,
				organizationId,
				binding.name,
				secret.id,
				assertVersionUsable(
					versionByKey.get(secretVersionKey(secret.id, versionNumber))
				),
				principal
			)
		);
		manager.persist(rows);
		return rows;
	}

	private assertBindingNames(
		ordinaryEnvironment: Readonly<Record<string, string>>,
		bindings: readonly SecretBindingDto[]
	): void {
		if (bindings.length > SECRET_LIMITS.BINDINGS_PER_SANDBOX) {
			throw new UnprocessableEntityException(
				'Too many secret environment bindings'
			);
		}
		const names = new Set<string>();
		for (const binding of bindings) {
			if (names.has(binding.name) || binding.name in ordinaryEnvironment) {
				throw new UnprocessableEntityException({
					code: SECRET_PROBLEM_CODE.DUPLICATE_ENVIRONMENT_NAME,
					message: `Environment name ${binding.name} is duplicated`,
				});
			}
			names.add(binding.name);
		}
	}

	private async ensureBindingSet(
		manager: EntityManager,
		organizationId: string,
		sandboxId: string
	): Promise<void> {
		await manager
			.createQueryBuilder(SandboxSecretBindingSet)
			.insert({
				sandboxId,
				organizationId,
				resourceVersion: SECRET_RESOURCE_VERSION_INITIAL,
				updatedAt: sql.now(),
			})
			.onConflict(['sandboxId'])
			.ignore()
			.execute();
	}

	private createBinding(
		sandboxId: string,
		organizationId: string,
		environmentName: string,
		secretId: string,
		version: SecretVersion,
		principal: HumanPrincipal
	): SandboxSecretBinding {
		const binding = new SandboxSecretBinding();
		binding.id = v4();
		binding.sandboxId = sandboxId;
		binding.organizationId = organizationId;
		binding.environmentName = environmentName;
		binding.secretId = secretId;
		binding.secretVersion = version.version;
		binding.secretVersionId = version.id;
		binding.createdByPrincipalType = principal.type;
		binding.createdByPrincipalId = principal.id;
		return binding;
	}
}
