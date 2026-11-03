<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { useIntersectionObserver } from 'runed';
import Spinner from '#lib/components/ui/spinner.svelte';

interface LoadMoreSentinelProps {
	loading: boolean;
	onLoadMore: () => void;
}

let { loading, onLoadMore }: LoadMoreSentinelProps = $props();

let sentinel = $state<HTMLElement>();

useIntersectionObserver(
	() => sentinel,
	(entries) => {
		if (!loading && entries.some((entry) => entry.isIntersecting)) {
			onLoadMore();
		}
	}
);
</script>

<div bind:this={sentinel} class="flex items-center justify-center py-3">
	{#if loading}
		<Spinner />
	{/if}
</div>
