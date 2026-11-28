<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const DEFAULT_TITLE = "This page couldn't load";
</script>

<script lang="ts">
import CircleAlert from '@lucide/svelte/icons/circle-alert';
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import EmptyState from '#lib/components/empty-state.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ErrorDetails from './error-details.svelte';

interface SectionErrorProps {
	title?: string;
	details?: string;
	backHref?: string;
	backLabel?: string;
	retrying?: boolean;
	onRetry?: () => void;
	actions?: Snippet;
	class?: ClassValue;
}

let {
	title = DEFAULT_TITLE,
	details,
	backHref,
	backLabel,
	retrying = false,
	onRetry,
	actions: extraActions,
	class: className,
}: SectionErrorProps = $props();
</script>

<div class="flex h-full flex-1 flex-col items-center justify-center">
	<EmptyState
		role="alert"
		size="lg"
		icon={CircleAlert}
		{title}
		class={className}
	>
		{#snippet actions()}
			{#if backHref && backLabel}
				<Chip variant="secondary" href={backHref}>{backLabel}</Chip>
			{/if}
			{@render extraActions?.()}
			{#if onRetry}
				<Chip variant="secondary" loading={retrying} onclick={onRetry}>
					Try again
				</Chip>
			{/if}
		{/snippet}
	</EmptyState>
	{#if details}
		<ErrorDetails class="mx-auto mb-12 w-full max-w-lg" {details} />
	{/if}
</div>
