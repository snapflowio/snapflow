/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityName, EventArgs, EventSubscriber } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
	ENCRYPTED_RECORD_KIND,
	ENCRYPTION_CONTEXT_SCHEMA_VERSION,
} from '../../../infra/encryption/constants/encryption.constants';
import type { EncryptionContext } from '../../../infra/encryption/schemas/encryption.schema';
import { EnvelopeEncryptionService } from '../../../infra/encryption/services/envelope-encryption.service';
import { PLATFORM_REGISTRY_ENCRYPTION_SCOPE } from '../../constants/docker-registry-persistence.constants';
import { DockerRegistry } from '../../entities/docker-registry.entity';

type SealedRegistry = Pick<
	DockerRegistry,
	'id' | 'organizationId' | 'passwordVersion'
>;

@Injectable()
export class RegistryPasswordCipher implements EventSubscriber<DockerRegistry> {
	constructor(
		private readonly encryption: EnvelopeEncryptionService,
		entityManager: EntityManager
	) {
		entityManager.getEventManager().registerSubscriber(this);
	}

	getSubscribedEntities(): EntityName<DockerRegistry>[] {
		return [DockerRegistry];
	}

	seal(registry: DockerRegistry, password: string): void {
		registry.password = password;
		registry.passwordVersion += 1;
		if (!password) {
			registry.encryptedPassword = null;
			return;
		}
		const plaintext = Buffer.from(password, 'utf8');
		try {
			registry.encryptedPassword = this.encryption.encrypt(
				plaintext,
				this.context(registry)
			);
		} finally {
			plaintext.fill(0);
		}
	}

	onLoad({ entity }: EventArgs<DockerRegistry>): void {
		if (typeof entity.encryptedPassword !== 'string') return;
		const plaintext = this.encryption.decrypt(
			entity.encryptedPassword,
			this.context(entity)
		);
		try {
			entity.password = plaintext.toString('utf8');
		} finally {
			plaintext.fill(0);
		}
	}

	private context(registry: SealedRegistry): EncryptionContext {
		return {
			recordKind: ENCRYPTED_RECORD_KIND.DOCKER_REGISTRY_PASSWORD,
			organizationId:
				registry.organizationId ?? PLATFORM_REGISTRY_ENCRYPTION_SCOPE,
			recordId: registry.id,
			recordVersion: registry.passwordVersion,
			schemaVersion: ENCRYPTION_CONTEXT_SCHEMA_VERSION,
		};
	}
}
