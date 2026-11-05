/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
	PULL_ACTIONS,
	REGISTRY_TOKEN,
	RegistrySubjectKind,
} from '../../../../docker-registry/constants/registry-token.constants';
import { DockerRegistryService } from '../../../../docker-registry/services/docker-registry.service';
import { RegistryTokenService } from '../../../../docker-registry/services/registry-token.service';
import {
	registrySubject,
	repositoryAccess,
} from '../../../../docker-registry/utils/registry-token-scope.util';
import { databaseNow } from '../../../../infra/database/utils/database-time.util';
import type { MachineSnapshotRegistryCredentialsDto } from '../../dto/machine-snapshot-control.dto';
import type { MachineSession } from '../../entities/machine-session.entity';
import { encodeSnapshotRegistryCredentials } from '../../utils/desired-state/machine-snapshot-inventory.util';
import { MachineSessionService } from '../machine-session.service';
import { DesiredSnapshotSetService } from './desired-snapshot-set.service';

const UNREFERENCED_REGISTRY_MESSAGE =
	'No snapshot the machine should hold is pulled from this registry';

@Injectable()
export class MachineSnapshotCredentialsService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessions: MachineSessionService,
		private readonly desiredSnapshots: DesiredSnapshotSetService,
		private readonly dockerRegistryService: DockerRegistryService,
		private readonly registryTokens: RegistryTokenService
	) {}

	/**
	 * Credentials for one registry, scoped to the snapshots this machine should
	 * hold from it. Platform registries get a pull token naming only those
	 * repositories.
	 */
	async deliver(
		machineId: string,
		session: MachineSession,
		registryId: string
	): Promise<MachineSnapshotRegistryCredentialsDto> {
		const refs = await this.entityManager.transactional(async (manager) => {
			const machine = await this.machineSessions.assertCurrent(
				manager,
				machineId,
				session.id,
				await databaseNow(manager)
			);
			const snapshots = await this.desiredSnapshots.forMachine(
				manager,
				machine,
				await this.desiredSnapshots.machineSandboxes(manager, machine.id)
			);
			return snapshots.flatMap(({ ref, source }) =>
				source.case === 'registry' && source.value.registryId === registryId
					? [ref]
					: []
			);
		});
		const registry =
			refs.length > 0
				? await this.dockerRegistryService.findOne(registryId)
				: null;
		if (!registry) {
			throw new NotFoundException(UNREFERENCED_REGISTRY_MESSAGE);
		}
		const authorized = await this.registryTokens.authorize(registry, {
			subject: registrySubject(RegistrySubjectKind.MACHINE, machineId),
			access: refs.map((ref) => repositoryAccess(ref, PULL_ACTIONS)),
			ttlSeconds: REGISTRY_TOKEN.PULL_TTL_SECONDS,
		});
		return {
			credentials: encodeSnapshotRegistryCredentials(registryId, authorized),
		};
	}
}
