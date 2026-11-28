/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox, SystemExposureService } from '@snapflow/api-client';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';
import {
	redeemSandboxAccess,
	requestSandboxSystemAccess,
} from '#lib/api/sandboxes/exposure.ts';

const SESSION_REFRESH_LEAD_MILLISECONDS = 5_000;
const MINIMUM_SESSION_REFRESH_DELAY_MILLISECONDS = 1;
const SANDBOX_SYSTEM_SESSION_QUERY_SCOPE = 'sandbox-system-session';

export interface SandboxSystemSessionArgs {
	enabled: boolean;
	sandbox: Sandbox;
	service: SystemExposureService;
}

const sandboxSystemSessionKey = (
	sandboxId: string,
	service: SystemExposureService
) => [SANDBOX_SYSTEM_SESSION_QUERY_SCOPE, sandboxId, service] as const;

interface SandboxSystemSessionData {
	expiresAt: number;
	url: string;
}

function sessionRefreshDelay({ expiresAt }: SandboxSystemSessionData): number {
	return Math.max(
		expiresAt - Date.now() - SESSION_REFRESH_LEAD_MILLISECONDS,
		MINIMUM_SESSION_REFRESH_DELAY_MILLISECONDS
	);
}

async function openSandboxSystemSession(
	sandbox: Sandbox,
	service: SystemExposureService
): Promise<SandboxSystemSessionData> {
	const access = await requestSandboxSystemAccess(sandbox, service);
	const expiresAt = new Date(access.sessionExpiresAt).getTime();
	if (!Number.isFinite(expiresAt)) {
		throw new Error('Sandbox access session returned an invalid expiry');
	}
	return { expiresAt, url: await redeemSandboxAccess(access.url) };
}

export class SandboxSystemSession {
	readonly query;
	readonly #queryClient = useQueryClient();
	readonly #queryKey;

	constructor(args: () => SandboxSystemSessionArgs) {
		this.#queryKey = $derived(
			sandboxSystemSessionKey(args().sandbox.id, args().service)
		);
		this.query = createQuery(() => {
			const { enabled, sandbox, service } = args();
			return {
				queryKey: this.#queryKey,
				queryFn: () => openSandboxSystemSession(sandbox, service),
				enabled,
				staleTime: Number.POSITIVE_INFINITY,
				refetchInterval: ({ state }) =>
					state.data ? sessionRefreshDelay(state.data) : false,
				refetchIntervalInBackground: true,
			};
		});
	}

	refresh = (): Promise<void> =>
		this.#queryClient.invalidateQueries({ queryKey: this.#queryKey });
}
