<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import BrandMark from '#lib/components/brand-mark.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ErrorShell from './error-shell.svelte';

const BRAND_MARK_SIZE = 22;
const HOME_HREF = '/';
</script>

<div class="flex min-h-dvh flex-col bg-bg">
	<ErrorShell
		title="Page not found"
		description="The page you're looking for doesn't exist or has been moved."
	>
		{#snippet icon()}
			<BrandMark size={BRAND_MARK_SIZE} class="text-brand" />
		{/snippet}
		<Chip onclick={() => history.back()}>Go back</Chip>
		<Chip variant="primary" href={HOME_HREF}>Return home</Chip>
	</ErrorShell>
</div>
