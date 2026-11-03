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
import SettingsSection from '#lib/components/settings/settings-section.svelte';

interface ListingSectionProps {
	label: string;
	layout?: 'grid' | 'list';
	children: Snippet;
}

let { label, layout = 'grid', children }: ListingSectionProps = $props();
</script>

<SettingsSection title={label}>
	<div
		class={layout === 'list'
			? 'flex flex-col gap-y-0.5'
			: 'grid grid-cols-[repeat(auto-fit,minmax(264px,1fr))] gap-x-6 gap-y-0.5'}
	>
		{@render children()}
	</div>
</SettingsSection>
