/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type ExportBillingUsageData,
	exportBillingUsage,
	type ListBillingSandboxUsageData,
	type ListBillingUsageData,
	type ListCustomerNetworkUsageData,
	type ListHostNetworkUsageData,
} from '@snapflow/api-client';
import {
	getBillingSandboxUsageOptions,
	getBillingStatementOptions,
	listBillingSandboxUsageInfiniteOptions,
	listBillingStatementsOptions,
	listBillingUsageInfiniteOptions,
	listCustomerNetworkUsageInfiniteOptions,
	listHostNetworkUsageInfiniteOptions,
} from '@snapflow/api-client/svelte-query';

export type NetworkUsageParty = 'customer' | 'host';

type NetworkUsageQuery = ListCustomerNetworkUsageData['query'] &
	ListHostNetworkUsageData['query'];

export function sandboxUsageInfiniteQueryOptions(
	query: ListBillingSandboxUsageData['query']
) {
	return listBillingSandboxUsageInfiniteOptions({ query });
}

export function sandboxUsageSummaryQueryOptions(sandboxId: string) {
	return getBillingSandboxUsageOptions({ path: { sandboxId } });
}

export function usageChargesInfiniteQueryOptions(
	query: ListBillingUsageData['query']
) {
	return listBillingUsageInfiniteOptions({ query });
}

export function networkUsageInfiniteQueryOptions(
	party: NetworkUsageParty,
	query: NetworkUsageQuery
) {
	return party === 'customer'
		? listCustomerNetworkUsageInfiniteOptions({ query })
		: listHostNetworkUsageInfiniteOptions({ query });
}

export function billingStatementsQueryOptions() {
	return listBillingStatementsOptions();
}

export function billingStatementQueryOptions(month: string) {
	return getBillingStatementOptions({ path: { month } });
}

export async function fetchBillingUsageExport(
	query: ExportBillingUsageData['query']
): Promise<string> {
	const { data } = await exportBillingUsage({ query, parseAs: 'text' });
	return data;
}
