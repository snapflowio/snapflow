<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import SnapflowStaticOverlay from '#lib/components/snapflow-static-overlay.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';
import ErrorDetails from './error-details.svelte';
import ErrorShell from './error-shell.svelte';

interface RootErrorPageProps {
	details: string | undefined;
	message: string;
	onRetry: () => void;
}

let { details, message, onRetry }: RootErrorPageProps = $props();
</script>

<main class="relative flex min-h-dvh flex-col bg-bg">
	<ErrorShell title="Something went wrong" description={message}>
		<Chip href={resolve(Path.DASHBOARD)}>Back to dashboard</Chip>
		<Chip variant="primary" onclick={onRetry}>Try again</Chip>
	</ErrorShell>
	{#if details}
		<ErrorDetails class="mx-auto mb-12 max-w-lg" {details} />
	{/if}
	<SnapflowStaticOverlay />
</main>
