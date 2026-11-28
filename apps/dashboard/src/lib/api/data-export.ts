/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	exportAccountData,
	exportOrganizationData,
} from '@snapflow/api-client';
import { mutationOptions } from '@tanstack/svelte-query';
import { downloadFile } from '#lib/utils/download-file.ts';

const ACCOUNT_EXPORT_FILENAME = 'snapflow-account.json';
const ORGANIZATION_EXPORT_FILENAME = 'snapflow-organization.json';

export function accountExportMutationOptions() {
	return mutationOptions({
		mutationFn: async () => {
			const { data } = await exportAccountData({ parseAs: 'blob' });
			downloadFile(data, ACCOUNT_EXPORT_FILENAME);
		},
		meta: { failure: 'Failed to download your data' },
	});
}

export function organizationExportMutationOptions() {
	return mutationOptions({
		mutationFn: async () => {
			const { data } = await exportOrganizationData({ parseAs: 'blob' });
			downloadFile(data, ORGANIZATION_EXPORT_FILENAME);
		},
		meta: { failure: 'Failed to download the organization data' },
	});
}
