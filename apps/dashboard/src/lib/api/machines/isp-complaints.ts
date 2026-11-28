/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateIspComplaint,
	createIspComplaint,
	downloadIspComplaintStatement,
	type IspComplaint,
} from '@snapflow/api-client';
import {
	listIspComplaintsOptions,
	listIspComplaintsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';

const CONTENT_DISPOSITION_HEADER = 'content-disposition';
const ATTACHMENT_FILENAME = /filename="([^"]+)"/;
const STATEMENT_FILENAME_PREFIX = 'snapflow-isp-statement-';
const STATEMENT_EXTENSION = '.pdf';

export function ispComplaintsQueryOptions(machineId: string) {
	return listIspComplaintsOptions({ path: { machineId } });
}

export function forwardIspComplaintMutationOptions(machineId: string) {
	return mutationOptions({
		mutationFn: async (body: CreateIspComplaint) =>
			(await createIspComplaint({ path: { machineId }, body })).data,
		meta: {
			success: 'ISP complaint forwarded',
			failure: 'Failed to forward the ISP complaint',
			invalidates: [listIspComplaintsQueryKey({ path: { machineId } })],
		},
	});
}

export function ispStatementMutationOptions(machineId: string) {
	return mutationOptions({
		mutationFn: async (complaint: IspComplaint) => {
			const { data, response } = await downloadIspComplaintStatement({
				path: { machineId, reportId: complaint.id },
				parseAs: 'blob',
			});
			const filename =
				ATTACHMENT_FILENAME.exec(
					response.headers.get(CONTENT_DISPOSITION_HEADER) ?? ''
				)?.[1] ??
				`${STATEMENT_FILENAME_PREFIX}${complaint.id}${STATEMENT_EXTENSION}`;
			return { data, filename };
		},
		meta: { failure: 'Failed to download the ISP statement' },
	});
}
