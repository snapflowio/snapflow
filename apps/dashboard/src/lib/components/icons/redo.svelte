<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { IconProps } from './icon-component.ts';

let props: IconProps = $props();
</script>

<svg
	width="12"
	height="12"
	viewBox="0 0 12 12"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	{...props}
>
	<path
		d="M9.5 4.5H4C2.62 4.5 1.5 5.62 1.5 7C1.5 8.38 2.62 9.5 4 9.5H7"
		stroke="currentColor"
		stroke-width="0.85"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path
		d="M8 2.5L10 4.5L8 6.5"
		stroke="currentColor"
		stroke-width="0.85"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
