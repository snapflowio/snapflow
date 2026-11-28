<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Timestamp from '#lib/components/ui/timestamp.svelte';

const NEVER_LABEL = 'Never';

interface MachineCheckedCellProps {
	value: string | undefined;
}

let { value }: MachineCheckedCellProps = $props();
</script>

{#if value}
	<Timestamp {value} />
{:else}
	<span class="text-(--text-subtle)">{NEVER_LABEL}</span>
{/if}
