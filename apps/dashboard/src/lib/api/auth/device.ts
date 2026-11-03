/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { authClient } from './client.ts';
import { unwrapAuthResult } from './result.ts';

export const DEVICE_USER_CODE_PARAM = 'user_code';
export const DEVICE_PENDING_STATUS = 'pending';

export const DEVICE_DECISION = {
	APPROVE: 'approve',
	DENY: 'deny',
} as const;

export type DeviceDecision =
	(typeof DEVICE_DECISION)[keyof typeof DEVICE_DECISION];

export function normalizeDeviceUserCode(code: string): string {
	return code.trim().toUpperCase();
}

const deviceQueryKeys = {
	claim: (userCode: string) => ['auth', 'device', userCode] as const,
};

export function deviceClaimQueryOptions(userCode: string) {
	return queryOptions({
		queryKey: deviceQueryKeys.claim(userCode),
		queryFn: async () =>
			unwrapAuthResult(
				await authClient.device({
					query: { [DEVICE_USER_CODE_PARAM]: userCode },
				})
			),
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
}

export function deviceDecisionMutationOptions(userCode: () => string) {
	return mutationOptions({
		mutationFn: async (decision: DeviceDecision) => {
			const body = { userCode: userCode() };
			unwrapAuthResult(
				decision === DEVICE_DECISION.APPROVE
					? await authClient.device.approve(body)
					: await authClient.device.deny(body)
			);
			return decision;
		},
	});
}
