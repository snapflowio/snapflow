<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { IconProps } from './icon-component.ts';

interface LoaderProps extends IconProps {
	animate?: boolean;
}
</script>

<script lang="ts">
let { animate = false, class: className, ...props }: LoaderProps = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width="24"
	height="24"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.55"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={[animate && 'animated', className]}
	aria-hidden="true"
	{...props}
>
	<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74" />
	<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74" />
</svg>

<style>
@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

.animated {
	animation: spin 1s linear infinite;
	transform-origin: center center;
	will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
	.animated {
		animation: none;
	}
}
</style>
