<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const STATEMENT_PARAM = 'statement';
</script>

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { billingStatementsQueryOptions } from '#lib/api/billing/usage.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import BillingHeader from '#lib/features/billing/components/billing-header.svelte';
import StatementDetailsModal from '#lib/features/billing/components/details/statement-details-modal.svelte';
import UsageList from '#lib/features/billing/components/usage-list.svelte';
import UsageRow from '#lib/features/billing/components/usage-row.svelte';
import {
	formatStatementMonth,
	formatStatementPeriod,
} from '#lib/features/billing/lib/format.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';

const statements = createQuery(() => billingStatementsQueryOptions());
const rows = $derived(statements.data ?? []);
const panel = new OpenRowParam(
	() => rows,
	(statement) => statement.month,
	{ param: STATEMENT_PARAM, closeWithBack: true }
);
</script>

<BillingHeader />
<PageColumn>
	<UsageList
		label="Statements"
		count={rows.length}
		isLoading={statements.isLoading}
		isError={statements.isError}
		isRetrying={statements.isFetching}
		onRetry={() => void statements.refetch()}
		loadingMessage="Loading statements..."
		errorMessage="Couldn't load statements."
		emptyMessage="Statements appear after your first billed month."
	>
		{#each rows as statement (statement.month)}
			{const month = $derived(formatStatementMonth(statement.month))}
			<UsageRow
				onSelect={() => panel.open(statement.month)}
				selectLabel={`Open the ${month} statement`}
			>
				<span class="w-37.5 shrink-0 truncate text-(--text-body) text-sm">
					{month}
				</span>
				<Badge size="sm" variant={statement.open ? 'amber' : 'gray'}>
					{statement.open ? 'In progress' : 'Closed'}
				</Badge>
				<span class="min-w-0 flex-1 truncate text-(--text-muted) text-caption">
					{formatStatementPeriod(statement.periodStart, statement.periodEnd)}
					(UTC)
				</span>
			</UsageRow>
		{/each}
	</UsageList>
</PageColumn>
<StatementDetailsModal month={panel.openId} onClose={panel.close} />
