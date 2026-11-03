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

function downloadBillingExport(
	data: BlobPart,
	name: string,
	format: string
): void {
	const url = URL.createObjectURL(new Blob([data]));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = `${BILLING_EXPORT_FILENAME_PREFIX}-${name}.${format}`;
	anchor.click();
	URL.revokeObjectURL(url);
}
</script>

<script lang="ts">
import Download from '@lucide/svelte/icons/download';
import { createMutation } from '@tanstack/svelte-query';
import { fetchBillingUsageExport } from '#lib/api/billing/usage.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import type {
	UsagePeriod,
	UsageWindow,
} from '#lib/features/billing/lib/usage-period.ts';

interface UsageExportProps {
	disabled: boolean;
	period: UsagePeriod;
	range: UsageWindow;
}

let { disabled, period, range }: UsageExportProps = $props();

const exportUsage = createMutation(() => ({
	mutationFn: async (format: ExportFormat) => {
		const data = await fetchBillingUsageExport({ format, ...range });
		downloadBillingExport(
			data,
			`${EXPORT_SUBJECT}-${period}-${new Date().toISOString().slice(0, ISO_DATE_LENGTH)}`,
			format
		);
	},
	meta: {
		success: 'Billing export downloaded',
		failure: 'Failed to export billing usage',
	},
}));
</script>

<DropdownMenu>
	<DropdownMenuTrigger disabled={disabled || exportUsage.isPending}>
		{#snippet child({
			props,
		})}
			<Chip {...props} leftIcon={Download} mobileIconOnly>
				{exportUsage.isPending ? 'Exporting...' : 'Export'}
			</Chip>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end">
		{#each EXPORT_FORMATS as { format, label } (format)}
			<DropdownMenuItem onSelect={() => exportUsage.mutate(format)}>
				<span class={MENU_LABEL_CLASS}>{label}</span>
			</DropdownMenuItem>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
