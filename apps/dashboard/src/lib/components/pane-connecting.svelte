<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const CONNECTING_LABEL = 'Connecting';
</script>

<script lang="ts">
import { DelayedReveal } from '#lib/components/ui/skeleton/delayed-reveal.svelte.ts';
import Spinner from '#lib/components/ui/spinner.svelte';

interface PaneConnectingProps {
	label?: string;
}

let { label = CONNECTING_LABEL }: PaneConnectingProps = $props();

const reveal = new DelayedReveal();
</script>

<div
	aria-busy="true"
	class="flex min-h-0 min-w-0 flex-1 items-center justify-center"
>
	{#if reveal.visible}
		<span class="inline-flex items-center gap-2 text-(--text-muted) text-sm">
			<Spinner {label} />
			{label}
		</span>
	{/if}
</div>
