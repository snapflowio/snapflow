/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	adminBeginExposureCutover,
	adminRollbackExposureCutover,
	adminVerifyExposureCutover,
	type ExposureCutoverDto,
} from '@snapflow/api-client';
import {
	adminListExposureCutoversOptions,
	adminListExposureCutoversQueryKey,
} from '@snapflow/api-client/svelte-query';
import { appMutationOptions } from '#lib/api/client/mutation-meta.ts';

const CUTOVER_ACTIONS = {
	begin: {
		run: (backendId: string) =>
			adminBeginExposureCutover({ path: { backendId } }),
		success: 'Cutover started',
		failure: 'Failed to start cutover',
	},
	verify: {
		run: (backendId: string) =>
			adminVerifyExposureCutover({ path: { backendId } }),
		success: 'Cutover verified and activated',
		failure: 'Failed to verify cutover',
	},
	rollback: {
		run: (backendId: string) =>
			adminRollbackExposureCutover({ path: { backendId } }),
		success: 'Cutover rolled back',
		failure: 'Failed to roll back cutover',
	},
} as const;

export type CutoverAction = keyof typeof CUTOVER_ACTIONS;

export interface CutoverActionRequest {
	action: CutoverAction;
	cutover: ExposureCutoverDto;
}

export function adminCutoversQueryOptions() {
	return adminListExposureCutoversOptions();
}

export function cutoverActionMutationOptions() {
	return appMutationOptions({
		mutationFn: async ({ action, cutover }: CutoverActionRequest) => {
			await CUTOVER_ACTIONS[action].run(cutover.backendId);
			return action;
		},
		meta: {
			invalidates: [adminListExposureCutoversQueryKey()],
			success: (action) => CUTOVER_ACTIONS[action].success,
			failure: (_error, { action }) => CUTOVER_ACTIONS[action].failure,
		},
	});
}
