/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { fakeInstance } from '../../../common/testing/instance.fake';
import {
	AUTH_CREDENTIAL_TYPES,
	type OrganizationAuthContext,
} from '../../../common/types/organization-auth-context.types';
import { PLATFORM_PRINCIPAL_TYPE } from '../../../common/types/platform-principal.types';
import { SystemRole } from '../../../user/enums/system-role.enum';
import { AllowGeneralSnapshots } from '../decorators/allow-general-snapshots.decorator';
import { Snapshot } from '../entities/snapshot.entity';
import { SnapshotService } from '../services/snapshot.service';
import { SnapshotAccessGuard } from './snapshot-access.guard';

const SNAPSHOT_ID = '5e000000-0000-4000-8000-000000000005';
const ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const OTHER_ORGANIZATION_ID = '7a000000-0000-4000-8000-000000000007';

class ProbeController {
	manage(): void {}

	@AllowGeneralSnapshots()
	read(): void {}
}

const member: OrganizationAuthContext = {
	role: SystemRole.USER,
	principal: {
		type: PLATFORM_PRINCIPAL_TYPE.HUMAN,
		id: 'member-user',
		email: 'member@snapflow.test',
		displayName: 'Member',
		systemRole: SystemRole.USER,
	},
	userId: 'member-user',
	email: 'member@snapflow.test',
	organizationId: ORGANIZATION_ID,
	memberId: 'member',
	memberRoles: [],
	credential: { type: AUTH_CREDENTIAL_TYPES.SESSION, id: 'member-session' },
};

function guardFor(
	snapshot: Pick<Snapshot, 'organizationId' | 'general'>
): SnapshotAccessGuard {
	return new SnapshotAccessGuard(
		new Reflector(),
		fakeInstance(SnapshotService, {
			getSnapshot: async () =>
				Object.assign(new Snapshot(), { id: SNAPSHOT_ID, ...snapshot }),
		})
	);
}

function request(handler: keyof ProbeController): ExecutionContextHost {
	return new ExecutionContextHost(
		[{ params: { id: SNAPSHOT_ID }, user: member }],
		ProbeController,
		ProbeController.prototype[handler]
	);
}

describe('SnapshotAccessGuard', () => {
	it('admits a snapshot of the active organization', async () => {
		assert.equal(
			await guardFor({
				organizationId: ORGANIZATION_ID,
				general: false,
			}).canActivate(request('manage')),
			true
		);
	});

	it('hides a snapshot of another organization', async () => {
		await assert.rejects(
			guardFor({
				organizationId: OTHER_ORGANIZATION_ID,
				general: false,
			}).canActivate(request('manage')),
			NotFoundException
		);
	});

	it('admits a general snapshot where general snapshots are allowed', async () => {
		assert.equal(
			await guardFor({
				organizationId: OTHER_ORGANIZATION_ID,
				general: true,
			}).canActivate(request('read')),
			true
		);
	});

	it('hides a general snapshot from management routes', async () => {
		await assert.rejects(
			guardFor({
				organizationId: OTHER_ORGANIZATION_ID,
				general: true,
			}).canActivate(request('manage')),
			NotFoundException
		);
	});
});
