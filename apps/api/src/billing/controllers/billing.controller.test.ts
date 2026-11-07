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
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import {
	ORGANIZATION_PRESET_ROLE,
	ORGANIZATION_ROLE,
	ORGANIZATION_ROLES,
} from '@snapflow/organization-access';
import { SnapflowAuthGuard } from '../../auth/guards/auth.guard';
import {
	AuthAddonService,
	type AuthenticationResult,
	type AuthSessionPayload,
} from '../../auth/services/auth-addon.service';
import { OrganizationAccessService } from '../../auth/services/organization-access.service';
import { AccessDeniedException } from '../../common/exceptions/access-denied.exception';
import { fakeValue } from '../../common/testing/instance.fake';
import {
	AUTH_CREDENTIAL_TYPES,
	type OrganizationAuthContext,
} from '../../common/types/organization-auth-context.types';
import { PLATFORM_PRINCIPAL_TYPE } from '../../common/types/platform-principal.types';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { OrganizationService } from '../../organization/services/organization.service';
import {
	grantsPermission,
	type PermissionPair,
} from '../../organization/utils/organization-permissions.util';
import { fakeSettings } from '../../settings/testing/settings.fake';
import { SystemRole } from '../../user/enums/system-role.enum';
import { BillingConfigService } from '../services/billing-config.service';
import { BillingController } from './billing.controller';

const ORGANIZATION_ID = '6f000000-0000-4000-8000-000000000006';
const PAYOUT_READER_ROLE = 'payout-reader';
const ROLE_GRANTS: Readonly<
	Record<string, Readonly<Record<string, readonly string[]>>>
> = {
	[ORGANIZATION_PRESET_ROLE.BILLING_ADMIN]:
		ORGANIZATION_ROLES[ORGANIZATION_PRESET_ROLE.BILLING_ADMIN].statements,
	[ORGANIZATION_PRESET_ROLE.AUDITOR]:
		ORGANIZATION_ROLES[ORGANIZATION_PRESET_ROLE.AUDITOR].statements,
	[ORGANIZATION_ROLE.MEMBER]:
		ORGANIZATION_ROLES[ORGANIZATION_ROLE.MEMBER].statements,
	[PAYOUT_READER_ROLE]: { payouts: ['read'] },
};

function prototypeOf<Service extends object>(
	service: abstract new (...args: never[]) => Service
): Service {
	return Object.create(service.prototype);
}

function member(role: string): OrganizationAuthContext {
	return {
		role: SystemRole.USER,
		principal: {
			type: PLATFORM_PRINCIPAL_TYPE.HUMAN,
			id: `${role}-user`,
			email: `${role}@snapflow.test`,
			displayName: role,
			systemRole: SystemRole.USER,
		},
		userId: `${role}-user`,
		email: `${role}@snapflow.test`,
		organizationId: ORGANIZATION_ID,
		memberId: `${role}-member`,
		memberRoles: [role],
		credential: { type: AUTH_CREDENTIAL_TYPES.SESSION, id: `${role}-session` },
	};
}

function guardFor(user: OrganizationAuthContext): SnapflowAuthGuard {
	const authentication: AuthenticationResult = {
		method: 'session',
		user,
		authSession: fakeValue<AuthSessionPayload>({ user: { id: user.userId } }),
		activeOrganizationReset: false,
	};
	const authAddon = Object.assign(prototypeOf(AuthAddonService), {
		authenticate: async () => authentication,
	});
	const access = Object.assign(prototypeOf(OrganizationAccessService), {
		grantedToContext: async (
			context: OrganizationAuthContext,
			requested: readonly PermissionPair[]
		) =>
			requested.filter((pair) =>
				context.memberRoles.some((role) =>
					grantsPermission(ROLE_GRANTS[role] ?? {}, pair)
				)
			),
	});
	const organizations = Object.assign(prototypeOf(OrganizationService), {
		assertActive: async () => undefined,
	});
	return new SnapflowAuthGuard(
		new Reflector(),
		authAddon,
		access,
		organizations,
		prototypeOf(TypedConfigService)
	);
}

function billingConfigRequest(): ExecutionContextHost {
	return new ExecutionContextHost(
		[{ method: 'GET', headers: {} }],
		BillingController,
		BillingController.prototype.billingConfig
	);
}

describe('GET /billing/config', () => {
	it('serves the customer-facing values from the runtime settings', async () => {
		const service = new BillingConfigService(
			fakeSettings({
				standardMarkupBasisPoints: 1_500,
				verifiedMarkupBasisPoints: 2_500,
				privatePoolMachineMonthlyMicroUsd: 4_000_000,
			})
		);

		assert.deepEqual(await service.get(), {
			standardMarkupBasisPoints: 1_500,
			verifiedMarkupBasisPoints: 2_500,
			privatePoolMachineMonthlyMicroUsd: '4000000',
		});
	});

	for (const role of [
		ORGANIZATION_PRESET_ROLE.BILLING_ADMIN,
		ORGANIZATION_PRESET_ROLE.AUDITOR,
		PAYOUT_READER_ROLE,
	]) {
		it(`admits the ${role} role`, async () => {
			assert.equal(
				await guardFor(member(role)).canActivate(billingConfigRequest()),
				true
			);
		});
	}

	it('denies a member that can read neither billing nor payouts', async () => {
		await assert.rejects(
			guardFor(member(ORGANIZATION_ROLE.MEMBER)).canActivate(
				billingConfigRequest()
			),
			AccessDeniedException
		);
	});
});
