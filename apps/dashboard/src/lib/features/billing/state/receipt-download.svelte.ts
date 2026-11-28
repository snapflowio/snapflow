/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	billingProfileQueryOptions,
	type ReceiptFormat,
	receiptDocumentMutationOptions,
} from '#lib/api/billing/receipts.ts';
import { billingStatementsQueryOptions } from '#lib/api/billing/usage.ts';
import { getPublicConfig } from '#lib/api/public-config.ts';
import { downloadFile } from '#lib/utils/download-file.ts';

const MONTH_OPEN_REASON = 'Available once the month closes';
const NO_DETAILS_REASON = 'Add billing details first';
const UNKNOWN_MONTH_REASON = 'No statement for this month yet';

export const RECEIPT_FORMATS = [
	{ format: 'pdf', label: 'Download receipt (PDF)' },
	{ format: 'csv', label: 'Download receipt (CSV)' },
] as const satisfies readonly { format: ReceiptFormat; label: string }[];

export class ReceiptDownload {
	readonly available = getPublicConfig().receiptsAvailable;
	readonly profile = createQuery(() => ({
		...billingProfileQueryOptions(),
		enabled: this.available,
	}));
	readonly statements = createQuery(() => billingStatementsQueryOptions());
	readonly mutation = createMutation(() => receiptDocumentMutationOptions());
	readonly hasDetails = $derived(
		this.profile.isSuccess && this.profile.data !== null
	);

	disabledReason = (month: string): string | undefined => {
		const statement = this.statements.data?.find(
			(each) => each.month === month
		);
		if (!statement) return UNKNOWN_MONTH_REASON;
		if (statement.open) return MONTH_OPEN_REASON;
		return this.hasDetails ? undefined : NO_DETAILS_REASON;
	};

	download = (month: string, format: ReceiptFormat): void => {
		this.mutation.mutate(
			{ month, format },
			{ onSuccess: ({ data, filename }) => downloadFile(data, filename) }
		);
	};
}
