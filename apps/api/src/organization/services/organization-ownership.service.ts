/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
	ORGANIZATION_ROLE,
	ORGANIZATION_ROLE_SEPARATOR,
} from '@snapflow/organization-access';
import { DockerRegistry } from '../../docker-registry/persistence/entities/docker-registry.entity';
import { EXPOSURE_DESIRED_STATE } from '../../networking/constants/exposure.constants';
import { Exposure } from '../../networking/entities/exposure.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { Machine } from '../../sandbox/machine/entities/machine.entity';
import { MachineState } from '../../sandbox/machine/enums/machine-state.enum';
import { Snapshot } from '../../sandbox/snapshot/entities/snapshot.entity';
import { Volume } from '../../sandbox/volume/entities/volume.entity';
import { VolumeState } from '../../sandbox/volume/enums/volume-state.enum';
import { Secret } from '../../secrets/entities/secret.entity';
import {
	LIVE_ORGANIZATION_RESOURCE,
	type LiveOrganizationResource,
} from '../constants/live-organization-resource.constants';
import type { Organization } from '../entities/organization.entity';

type SoleOwnedOrganization = Pick<Organization, 'id' | 'name' | 'personal'>;

interface LiveResourceCounter {
	resource: LiveOrganizationResource;
	count: (manager: EntityManager, organizationId: string) => Promise<number>;
}

const LIVE_RESOURCE_COUNTERS: readonly LiveResourceCounter[] = [
	{
		resource: LIVE_ORGANIZATION_RESOURCE.SANDBOXES,
		count: (manager, organizationId) =>
			manager.count(Sandbox, {
				organizationId,
				state: { $ne: SandboxState.DESTROYED },
			}),
	},
	{
		resource: LIVE_ORGANIZATION_RESOURCE.SNAPSHOTS,
		count: (manager, organizationId) =>
			manager.count(Snapshot, { organizationId }),
	},
	{
		resource: LIVE_ORGANIZATION_RESOURCE.VOLUMES,
		count: (manager, organizationId) =>
			manager.count(Volume, {
				organizationId,
				state: { $ne: VolumeState.DELETED },
			}),
	},
	{
		resource: LIVE_ORGANIZATION_RESOURCE.MACHINES,
		count: (manager, organizationId) =>
			manager.count(Machine, {
				organizationId,
				state: { $ne: MachineState.DECOMMISSIONED },
			}),
	},
	{
		resource: LIVE_ORGANIZATION_RESOURCE.REGISTRIES,
		count: (manager, organizationId) =>
			manager.count(DockerRegistry, { organizationId }),
	},
	{
		resource: LIVE_ORGANIZATION_RESOURCE.SECRETS,
		count: (manager, organizationId) =>
			manager.count(Secret, { organizationId }),
	},
	{
		resource: LIVE_ORGANIZATION_RESOURCE.EXPOSURES,
		count: (manager, organizationId) =>
			manager.count(Exposure, {
				organizationId,
				desiredState: { $ne: EXPOSURE_DESIRED_STATE.DELETED },
			}),
	},
];

const SOLE_OWNED_ORGANIZATIONS_SQL = `SELECT organization.id, organization.name, organization.personal
	 FROM organization
	 JOIN member AS membership
	   ON membership."organizationId" = organization.id
	  AND membership."userId" = ?
	  AND ? = ANY(string_to_array(membership.role, ?))
	 WHERE NOT EXISTS (
	   SELECT 1
	   FROM member AS co_owner
	   WHERE co_owner."organizationId" = organization.id
	     AND co_owner."userId" <> ?
	     AND ? = ANY(string_to_array(co_owner.role, ?))
	 )`;

@Injectable()
export class OrganizationOwnershipService {
	constructor(private readonly entityManager: EntityManager) {}

	async findLiveResources(
		organizationId: string
	): Promise<LiveOrganizationResource[]> {
		const manager = this.entityManager.fork();
		const counts = await Promise.all(
			LIVE_RESOURCE_COUNTERS.map(async ({ resource, count }) => ({
				resource,
				count: await count(manager, organizationId),
			}))
		);
		return counts
			.filter(({ count }) => count > 0)
			.map(({ resource }) => resource);
	}

	findSoleOwnedOrganizations(userId: string): Promise<SoleOwnedOrganization[]> {
		return this.entityManager
			.fork()
			.execute<SoleOwnedOrganization[]>(SOLE_OWNED_ORGANIZATIONS_SQL, [
				userId,
				ORGANIZATION_ROLE.OWNER,
				ORGANIZATION_ROLE_SEPARATOR,
				userId,
				ORGANIZATION_ROLE.OWNER,
				ORGANIZATION_ROLE_SEPARATOR,
			]);
	}
}
