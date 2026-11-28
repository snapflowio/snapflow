<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';

const BRAND_MARK_SIZE = 48;

interface AuthHeaderProps {
	title: string;
	description?: string | Snippet;
}
</script>

<script lang="ts">
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import BrandMark from '#lib/components/brand-mark.svelte';

let { title, description }: AuthHeaderProps = $props();

const { homeHref } = getWebsiteLinks();
</script>

<div class="flex flex-col gap-y-4">
	<a
		href={homeHref}
		aria-label="Snapflow home"
		class="w-fit text-(--text-primary) outline-none transition-opacity focus-visible:opacity-70"
	>
		<BrandMark size={BRAND_MARK_SIZE} />
	</a>
	<div class="flex flex-col gap-4">
		<h1
			class="text-balance font-heading font-normal text-(--text-primary) text-2xl leading-8"
		>
			{title}
		</h1>
		{#if description !== undefined}
			<p class="text-balance text-(--text-muted) text-lg leading-7">
				{#if typeof description === 'string'}
					{description}
				{:else}
					{@render description()}
				{/if}
			</p>
		{/if}
	</div>
</div>
