/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiErrorCode,
	type BillingProfile,
	type DownloadBillingReceiptData,
	downloadBillingReceipt,
	getBillingProfile,
	issueBillingReceipt,
	type UpdateBillingProfile,
	updateBillingProfile,
} from '@snapflow/api-client';
import { getBillingProfileQueryKey } from '@snapflow/api-client/svelte-query';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { hasErrorCode } from '#lib/api/errors/api-error-details.ts';

export type ReceiptFormat = DownloadBillingReceiptData['path']['format'];

interface ReceiptRequest {
	month: string;
	format: ReceiptFormat;
}

const CONTENT_DISPOSITION_HEADER = 'content-disposition';
const ATTACHMENT_FILENAME = /filename="([^"]+)"/;

export function billingProfileQueryOptions() {
	return queryOptions({
		queryKey: getBillingProfileQueryKey(),
		queryFn: async ({ signal }): Promise<BillingProfile | null> => {
			try {
				return (await getBillingProfile({ signal })).data;
			} catch (error) {
				if (hasErrorCode(error, ApiErrorCode.BillingProfileNotFound)) {
					return null;
				}
				throw error;
			}
		},
	});
}

export function updateBillingProfileMutationOptions() {
	return mutationOptions({
		mutationFn: async (body: UpdateBillingProfile) =>
			(await updateBillingProfile({ body })).data,
		meta: {
			success: 'Billing details saved',
			failure: 'Failed to save the billing details',
			invalidates: [getBillingProfileQueryKey()],
		},
	});
}

export function receiptDocumentMutationOptions() {
	return mutationOptions({
		mutationFn: async ({ month, format }: ReceiptRequest) => {
			const { data: receipt } = await issueBillingReceipt({ body: { month } });
			const { data, response } = await downloadBillingReceipt({
				path: { receiptId: receipt.id, format },
				parseAs: 'blob',
			});
			const filename =
				ATTACHMENT_FILENAME.exec(
					response.headers.get(CONTENT_DISPOSITION_HEADER) ?? ''
				)?.[1] ?? `${receipt.number}.${format}`;
			return { data, filename };
		},
		meta: { failure: 'Failed to download the receipt' },
	});
}
