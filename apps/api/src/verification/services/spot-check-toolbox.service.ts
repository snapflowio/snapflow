/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import {
	type ExecuteResponse,
	executeCommand,
	type Options,
	uploadFile,
} from '@snapflow/toolbox-api-client';
import { ApiKey } from '../../auth/entities/api-key.entity';
import {
	apiKeyCreator,
	storedApiKeyPermissions,
} from '../../auth/utils/api-key-metadata.util';
import { AUTH_CREDENTIAL_TYPES } from '../../common/types/organization-auth-context.types';
import {
	type HumanPrincipal,
	PLATFORM_PRINCIPAL_TYPE,
} from '../../common/types/platform-principal.types';
import { SYSTEM_EXPOSURE_SERVICE } from '../../networking/constants/exposure.constants';
import { SystemExposureLeaseService } from '../../networking/services/exposure/system-exposure-lease.service';
import { ProtectedAccessGrantService } from '../../networking/services/protected-access/protected-access-grant.service';
import { SANDBOX_WRITE_PERMISSION } from '../../networking/utils/exposure/system-exposure-access-policy.util';
import type { AccessRequester } from '../../networking/utils/protected-access-session.util';
import { User } from '../../user/entities/user.entity';
import { isBanActive } from '../../user/utils/user-ban.util';
import { SPOT_CHECK } from '../constants/spot-check.constants';
import type { ToolboxCommand } from '../types/spot-check.types';

const EDGE_ACCESS_COOKIE_PATTERN =
	/^__Host-Snapflow-Access-v1-[a-f0-9]{16}=[^;]+$/;
const COOKIE_ATTRIBUTE_SEPARATOR = ';';
const COOKIE_HEADER = 'Cookie';
const MANUAL_REDIRECT = 'manual';

type ToolboxConnection = Required<Pick<Options, 'baseUrl' | 'headers'>>;

export interface SpotCheckCredential {
	requester: AccessRequester;
	principal: HumanPrincipal;
}

@Injectable()
export class SpotCheckToolboxService {
	constructor(
		private readonly exposures: SystemExposureLeaseService,
		private readonly grants: ProtectedAccessGrantService
	) {}

	async credential(
		manager: EntityManager,
		organizationId: string,
		now: Date
	): Promise<SpotCheckCredential | null> {
		const keys = await manager.find(
			ApiKey,
			{
				referenceId: organizationId,
				enabled: true,
				$or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
			},
			{ orderBy: { createdAt: 'ASC' } }
		);
		for (const key of keys) {
			const userId = apiKeyCreator(key.metadata);
			const permissions = storedApiKeyPermissions(key.permissions);
			if (
				!userId ||
				!permissions[SANDBOX_WRITE_PERMISSION.resource]?.includes(
					SANDBOX_WRITE_PERMISSION.action
				)
			) {
				continue;
			}
			const user = await manager.findOne(User, { id: userId });
			if (!user || isBanActive(user, now)) continue;
			return {
				requester: {
					organizationId,
					userId,
					credential: { type: AUTH_CREDENTIAL_TYPES.API_KEY, id: key.id },
				},
				principal: {
					type: PLATFORM_PRINCIPAL_TYPE.HUMAN,
					id: user.id,
					email: user.email,
					displayName: user.name,
					systemRole: user.role,
				},
			};
		}
		return null;
	}

	async execute(
		sandboxId: string,
		credential: SpotCheckCredential,
		{ command, envs }: ToolboxCommand
	): Promise<ExecuteResponse> {
		const { data } = await executeCommand({
			...(await this.connect(sandboxId, credential)),
			body: { command, envs, timeout: SPOT_CHECK.COMMAND_TIMEOUT_SECONDS },
			throwOnError: true,
		});
		return data;
	}

	async upload(
		sandboxId: string,
		credential: SpotCheckCredential,
		path: string,
		file: Blob
	): Promise<void> {
		await uploadFile({
			...(await this.connect(sandboxId, credential)),
			query: { path },
			body: { file },
			throwOnError: true,
		});
	}

	private async connect(
		sandboxId: string,
		{ requester }: SpotCheckCredential
	): Promise<ToolboxConnection> {
		const exposure = await this.exposures.request(
			requester.organizationId,
			sandboxId,
			SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
			SPOT_CHECK.TOOLBOX_SESSION_SECONDS
		);
		const grant = await this.grants.issueWhenActive(
			requester,
			sandboxId,
			exposure.id,
			{ sessionLifetimeSeconds: SPOT_CHECK.TOOLBOX_SESSION_SECONDS },
			true
		);
		return {
			baseUrl: new URL(grant.url).origin,
			headers: { [COOKIE_HEADER]: await this.redeem(grant.url) },
		};
	}

	private async redeem(url: string): Promise<string> {
		const response = await fetch(url, { redirect: MANUAL_REDIRECT });
		await response.body?.cancel();
		const cookie = response.headers
			.getSetCookie()
			.map((value) => value.split(COOKIE_ATTRIBUTE_SEPARATOR, 1)[0])
			.find((value) => EDGE_ACCESS_COOKIE_PATTERN.test(value));
		if (!cookie) {
			throw new Error('The edge did not establish a toolbox access session');
		}
		return cookie;
	}
}
