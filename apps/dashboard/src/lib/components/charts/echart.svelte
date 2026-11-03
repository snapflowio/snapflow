<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { ECharts } from 'echarts/core';
import { useResizeObserver } from 'runed';
import type { ClassValue } from 'svelte/elements';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import FeedbackState from '#lib/components/feedback-state.svelte';
import type { ChartOption } from './echarts.ts';

interface EChartProps {
	option: ChartOption;
	class?: ClassValue;
}

let { option, class: className }: EChartProps = $props();
let loadError = $state<SnapflowError>();

function mountChart(node: HTMLDivElement) {
	let chart = $state.raw<ECharts>();
	let cancelled = false;
	let introApplied = false;

	useResizeObserver(
		() => (chart ? node : null),
		() => {
			const instance = chart;
			const { clientWidth, clientHeight } = node;
			if (!instance || clientWidth === 0 || clientHeight === 0) return;
			if (
				clientWidth === instance.getWidth() &&
				clientHeight === instance.getHeight()
			) {
				return;
			}
			instance.resize();
		}
	);

	import('./echarts.ts')
		.then(({ initChart }) => {
			if (cancelled) return;
			chart = initChart(node);
		})
		.catch((error: unknown) => {
			loadError = SnapflowError.fromUnknown(error);
		});

	$effect(() => {
		const instance = chart;
		if (!instance) return;
		instance.setOption(
			introApplied ? { ...option, animation: false } : option,
			{ notMerge: true }
		);
		introApplied = true;
	});

	return () => {
		cancelled = true;
		chart?.dispose();
	};
}
</script>

{#if loadError}
	<FeedbackState tone="error" message={loadError.message} class={className} />
{:else}
	<div {@attach mountChart} class={className}></div>
{/if}
