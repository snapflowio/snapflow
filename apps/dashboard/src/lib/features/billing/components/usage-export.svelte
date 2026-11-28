<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ExportBillingUsageData } from '@snapflow/api-client';

type ExportFormat = NonNullable<
	NonNullable<ExportBillingUsageData['query']>['format']
>;

const EXPORT_SUBJECT = 'usage';
const EXPORT_FORMATS = [
	{ format: 'csv', label: 'CSV' },
	{ format: 'json', label: 'JSON' },
] as const satisfies readonly { format: ExportFormat; label: string }[];
const BILLING_EXPORT_FILENAME_PREFIX = 'snapflow';
const ISO_DATE_LENGTH = 10;
</script>

<script lang="ts">
import Download from '@lucide/svelte/icons/download';
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import { createMutation } from '@tanstack/svelte-query';
import { fetchBillingUsageExport } from '#lib/api/billing/usage.ts';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuLabel from '#lib/components/ui/dropdown-menu/dropdown-menu-label.svelte';
import DropdownMenuSeparator from '#lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import IconButton from '#lib/components/ui/icon-button.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import type {
	UsagePeriod,
	UsageWindow,
} from '#lib/features/billing/lib/usage-period.ts';
import { downloadFile } from '#lib/utils/download-file.ts';

interface UsageExportProps {
	disabled: boolean;
	period: UsagePeriod;
	range: UsageWindow;
	updatedAt?: string | Date | null;
}

let { disabled, period, range, updatedAt }: UsageExportProps = $props();

const exportUsage = createMutation(() => ({
	mutationFn: async (format: ExportFormat) => {
		const data = await fetchBillingUsageExport({ format, ...range });
		downloadFile(
			data,
			`${BILLING_EXPORT_FILENAME_PREFIX}-${EXPORT_SUBJECT}-${period}-${new Date().toISOString().slice(0, ISO_DATE_LENGTH)}.${format}`
		);
	},
	meta: {
		success: 'Billing export downloaded',
		failure: 'Failed to export billing usage',
	},
}));
</script>

<DropdownMenu>
	<DropdownMenuTrigger disabled={exportUsage.isPending}>
		{#snippet child({ props })}
			<IconButton
				{...props}
				variant="ghost"
				size="md"
				label="Usage actions"
				icon={Ellipsis}
				aria-busy={exportUsage.isPending}
			/>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end" class="w-56">
		{#each EXPORT_FORMATS as { format, label } (format)}
			<DropdownMenuItem {disabled} onSelect={() => exportUsage.mutate(format)}>
				<Download />
				<span class={MENU_LABEL_CLASS}>{`Export ${label}`}</span>
			</DropdownMenuItem>
		{/each}
		{#if updatedAt}
			<DropdownMenuSeparator />
			<DropdownMenuLabel class="font-normal">
				Updated&nbsp;<Timestamp value={updatedAt} />
			</DropdownMenuLabel>
		{/if}
	</DropdownMenuContent>
</DropdownMenu>
