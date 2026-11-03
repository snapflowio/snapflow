<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
type AuthNavPromptTarget =
	| { href: string; onSelect?: undefined }
	| { onSelect: () => void; href?: undefined };

type AuthNavPromptProps = AuthNavPromptTarget & {
	linkLabel: string;
	prompt?: string;
	disabled?: boolean;
};
</script>

<script lang="ts">
import Chip from '#lib/components/ui/chip/chip.svelte';

let {
	prompt,
	href,
	onSelect,
	linkLabel,
	disabled = false,
}: AuthNavPromptProps = $props();
</script>

<div class="flex items-center justify-center gap-1 text-sm">
	{#if prompt}
		<span class="text-(--text-muted)">{prompt}</span>
	{/if}
	{#if href !== undefined}
		<Chip {href} class="border border-border">{linkLabel}</Chip>
	{:else}
		<Chip {disabled} onclick={onSelect} class="border border-border">
			{linkLabel}
		</Chip>
	{/if}
</div>
