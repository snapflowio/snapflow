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
	width="6"
	height="10"
	viewBox="0 0 6 10"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	{...props}
>
	<path
		d="M1 1L5 5L1 9"
		stroke="currentColor"
		stroke-width="1.2"
		stroke-linecap="square"
		stroke-linejoin="miter"
		fill="none"
	/>
</svg>
