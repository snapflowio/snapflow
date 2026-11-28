<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Lock from '@lucide/svelte/icons/lock';
import type { ClassValue } from 'svelte/elements';
import EmptyState from '#lib/components/empty-state.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { Path, resolvePath } from '#lib/routing/paths.ts';

interface ResourceNoAccessProps {
	resource: string;
	role?: string;
	class?: ClassValue;
}

let { resource, role, class: className }: ResourceNoAccessProps = $props();

const title = $derived(
	role
		? `You need the ${role} role to view ${resource}`
		: `You need permission to view ${resource}`
);
</script>

<EmptyState icon={Lock} {title} class={className}>
	{#snippet actions()}
		<Chip variant="secondary" href={resolvePath(Path.MEMBERS)}
			>Ask an owner</Chip
		>
	{/snippet}
</EmptyState>
