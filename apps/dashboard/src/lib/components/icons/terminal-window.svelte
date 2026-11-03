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
	height="14"
	viewBox="0 0 16 14"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	{...props}
>
	<path
		d="M3 0C1.34 0 0 1.34 0 3V11C0 12.66 1.34 14 3 14H13C14.66 14 16 12.66 16 11V3C16 1.34 14.66 0 13 0H3ZM1 3C1 1.9 1.9 1 3 1H13C14.1 1 15 1.9 15 3V4H1V3ZM1 5H15V11C15 12.1 14.1 13 13 13H3C1.9 13 1 12.1 1 11V5Z"
		fill="currentColor"
	/>
	<circle cx="3.5" cy="2.5" r="0.75" fill="currentColor" />
	<circle cx="5.75" cy="2.5" r="0.75" fill="currentColor" />
	<circle cx="8" cy="2.5" r="0.75" fill="currentColor" />
</svg>
