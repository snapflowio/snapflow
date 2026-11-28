<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { HostMachine } from '@snapflow/api-client';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import Badge from '#lib/components/ui/badge.svelte';
import { statusBadgeVariant } from '#lib/features/earnings/lib/earnings-status.ts';
import { machineListingStatusCopy } from '#lib/features/machines/lib/machine-listing-status.ts';

interface MachineListingCellProps {
	host: HostMachine | undefined;
}

let { host }: MachineListingCellProps = $props();

const status = $derived(host ? machineListingStatusCopy(host) : null);
</script>

{#if status}
	<Badge
		size="sm"
		variant={statusBadgeVariant(status)}
		tooltip={status.description ?? undefined}
	>
		{status.label}
	</Badge>
{:else}
	<span class="text-(--text-subtle)">{EMPTY_CELL_PLACEHOLDER}</span>
{/if}
