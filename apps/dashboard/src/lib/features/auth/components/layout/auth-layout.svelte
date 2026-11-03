<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import BrandMark from '#lib/components/brand-mark.svelte';
import SnapflowStaticOverlay from '#lib/components/snapflow-static-overlay.svelte';

const BRAND_MARK_SIZE = 24;

interface AuthLayoutProps {
	children: Snippet;
	footer?: Snippet;
}

let { children, footer }: AuthLayoutProps = $props();

const { homeHref } = getWebsiteLinks();
</script>

<div
	class="relative isolate flex min-h-dvh flex-col bg-bg text-(--text-primary)"
>
	<header>
		<nav
			class="mx-auto flex w-full max-w-[1446px] items-center px-12 py-4 max-lg:px-8 max-sm:px-5"
		>
			<a
				href={homeHref}
				aria-label="Snapflow home"
				class="flex h-7.5 items-center text-(--text-body)"
			>
				<span
					class="inline-flex items-center transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover-hover:scale-108"
				>
					<BrandMark size={BRAND_MARK_SIZE} />
				</span>
			</a>
		</nav>
	</header>
	<div class="flex flex-1 items-center justify-center px-4 pb-16">
		<div class="w-full max-w-100">{@render children()}</div>
	</div>
	{@render footer?.()}
	<SnapflowStaticOverlay />
</div>
