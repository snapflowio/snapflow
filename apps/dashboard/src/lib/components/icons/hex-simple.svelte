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
	width="16"
	height="16"
	viewBox="0 0 24 24"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	{...props}
>
	<path
		d="M12 2L20.66 7V17L12 22L3.34 17V7L12 2Z"
		fill="none"
		stroke="currentColor"
		stroke-width="1.55"
		stroke-linejoin="round"
	/>
	<circle
		cx="12"
		cy="12"
		r="4"
		fill="none"
		stroke="currentColor"
		stroke-width="1.55"
	/>
</svg>
