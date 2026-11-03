<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const PERCENT = 100;
const FADE_OUT = { duration: 200 } as const;
</script>

<script lang="ts">
import { fade } from 'svelte/transition';
import { NavigationProgress } from './navigation-progress.svelte.ts';

const progress = new NavigationProgress();
</script>

{#if progress.visible}
	<div
		role="progressbar"
		aria-label="Loading page"
		aria-valuemin={0}
		aria-valuemax={PERCENT}
		aria-valuenow={Math.round(progress.value * PERCENT)}
		class="pointer-events-none fixed inset-x-0 top-0 z-60 h-0.5"
		out:fade={FADE_OUT}
	>
		<div
			class="h-full origin-left bg-(--brand-accent)"
			style:transform={`scaleX(${progress.value})`}
		></div>
	</div>
{/if}
