/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { sql } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import {
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { tenantScopedRelationKey } from '../../infra/database/utils/composite-relation-key.util';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import type { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import {
	SECRET_DELIVERY_OUTCOME,
	type SecretDeliveryOutcome,
} from '../constants/secret.constants';
import { SandboxSecretBinding } from '../entities/sandbox-secret-binding.entity';
import { SecretDeliveryEvent } from '../entities/secret-delivery-event.entity';
import { SecretVersion } from '../entities/secret-version.entity';
import { SecretVersionCipherService } from './secret-version-cipher.service';

export interface SandboxSecretDelivery {
	sandbox: Pick<Sandbox, 'id' | 'organizationId'>;
	placement: Pick<
		SandboxPlacement,
		'id' | 'machineId' | 'assignmentGeneration'
	>;
	machineSessionId: string;
	specGeneration: number;
}

const SANDBOXES_WITH_SECRETS_SQL =
	'select distinct "sandboxId" from "sandbox_secret_binding" where "sandboxId" = any(array[?]::varchar[])';

export type SandboxSecretDeliveryResult =
	| { delivered: true; environment: Record<string, string> }
	| { delivered: false };

@Injectable()
export class MachineSandboxSecretDeliveryService {
	constructor(private readonly cipher: SecretVersionCipherService) {}

	async sandboxesWithSecrets(
		manager: EntityManager,
		sandboxIds: readonly string[]
	): Promise<ReadonlySet<string>> {
		if (sandboxIds.length === 0) return new Set();
		const rows = await manager.execute<{ sandboxId: string }[]>(
			SANDBOXES_WITH_SECRETS_SQL,
			[sandboxIds]
		);
		return new Set(rows.map(({ sandboxId }) => sandboxId));
	}

	async deliverEnvironment(
		manager: EntityManager,
		delivery: SandboxSecretDelivery
	): Promise<SandboxSecretDeliveryResult> {
		const { sandbox } = delivery;
		const bindings = await manager.find(
			SandboxSecretBinding,
			{
				sandboxId: tenantScopedRelationKey(sandbox.id, sandbox.organizationId),
			},
			{ orderBy: { environmentName: 'ASC' } }
		);
		if (bindings.length === 0) return { delivered: true, environment: {} };

		const versions = await manager.find(
			SecretVersion,
			{
				id: {
					$in: [
						...new Set(bindings.map(({ secretVersionId }) => secretVersionId)),
					],
				},
			},
			{ populate: ['encryptedEnvelope'], refresh: true }
		);
		const versionById = new Map(
			versions.map((version) => [version.id, version])
		);
		const environment: Record<string, string> = {};
		for (const binding of bindings) {
			let plaintext: Buffer;
			try {
				plaintext = this.cipher.decryptLoadedVersion(
					sandbox.organizationId,
					versionById.get(binding.secretVersionId)
				);
			} catch (error) {
				const rejectedOutcome = rejectedDeliveryOutcome(error);
				if (!rejectedOutcome) throw error;
				clearEnvironment(environment);
				await this.record(manager, delivery, [binding], rejectedOutcome);
				return { delivered: false };
			}
			try {
				environment[binding.environmentName] = plaintext.toString('utf8');
			} finally {
				plaintext.fill(0);
			}
		}
		await this.record(
			manager,
			delivery,
			bindings,
			SECRET_DELIVERY_OUTCOME.DELIVERED
		);
		return { delivered: true, environment };
	}

	private async record(
		manager: EntityManager,
		delivery: SandboxSecretDelivery,
		bindings: readonly SandboxSecretBinding[],
		outcome: SecretDeliveryOutcome
	): Promise<void> {
		await manager
			.createQueryBuilder(SecretDeliveryEvent)
			.insert(
				bindings.map((binding) => ({
					id: v4(),
					organizationId: delivery.sandbox.organizationId,
					secretVersionId: binding.secretVersionId,
					sandboxId: delivery.sandbox.id,
					placementId: delivery.placement.id,
					machineSessionId: delivery.machineSessionId,
					specGeneration: delivery.specGeneration,
					machineId: delivery.placement.machineId,
					assignmentGeneration: delivery.placement.assignmentGeneration,
					environmentName: binding.environmentName,
					outcome,
					createdAt: sql.now(),
				}))
			)
			.onConflict([
				'placementId',
				'specGeneration',
				'machineSessionId',
				'secretVersionId',
				'environmentName',
			])
			.ignore()
			.execute();
	}
}

export function clearEnvironment(environment: Record<string, string>): void {
	for (const name of Object.keys(environment)) {
		delete environment[name];
	}
}

function rejectedDeliveryOutcome(error: unknown): SecretDeliveryOutcome | null {
	if (error instanceof NotFoundException) {
		return SECRET_DELIVERY_OUTCOME.REJECTED_MISSING;
	}
	if (error instanceof UnprocessableEntityException) {
		return SECRET_DELIVERY_OUTCOME.REJECTED_REVOKED;
	}
	return null;
}
