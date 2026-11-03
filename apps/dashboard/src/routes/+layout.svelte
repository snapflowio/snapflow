<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import '#lib/styles/global.css';
import { setLucideProps } from '@lucide/svelte/context';
import { QueryClientProvider } from '@tanstack/svelte-query';
import NavigationProgress from '#lib/components/app/navigation-progress.svelte';
import { ICON_STROKE_WIDTH } from '#lib/components/icons/icon-component.ts';
import ToastViewport from '#lib/components/ui/toast/toast-viewport.svelte';
import type { LayoutProps } from './$types';

let { data, children }: LayoutProps = $props();

setLucideProps({ strokeWidth: ICON_STROKE_WIDTH });
</script>

<QueryClientProvider client={data.queryClient}>
	<NavigationProgress />
	{@render children()}
	<ToastViewport />
</QueryClientProvider>
