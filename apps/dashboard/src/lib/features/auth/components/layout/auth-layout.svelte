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
import SnapflowStaticOverlay from '#lib/components/snapflow-static-overlay.svelte';

interface AuthLayoutProps {
	children: Snippet;
	footer?: Snippet;
}

let { children, footer }: AuthLayoutProps = $props();
</script>

<div
	class="relative isolate flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-bg px-4 py-12 text-(--text-primary)"
>
	<main
		class="flex w-full max-w-md flex-col justify-between gap-8 rounded-3xl bg-surface-1 p-8 sm:p-12"
	>
		{@render children()}
	</main>
	{@render footer?.()}
	<SnapflowStaticOverlay />
</div>
