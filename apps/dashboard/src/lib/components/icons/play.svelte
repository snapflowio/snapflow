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
	width="10"
	height="10"
	viewBox="0 0 10 10"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
	{...props}
>
	<path
		d="M6.13 1.7C7.08 2.24 7.83 2.66 8.37 3.05C8.9 3.44 9.3 3.85 9.44 4.4C9.55 4.79 9.55 5.21 9.44 5.6C9.3 6.15 8.9 6.56 8.37 6.95C7.83 7.34 7.08 7.76 6.13 8.3L6.13 8.3L6.13 8.3C5.21 8.83 4.44 9.27 3.85 9.52C3.25 9.77 2.71 9.9 2.19 9.75C1.8 9.64 1.45 9.43 1.16 9.15C0.78 8.76 0.63 8.22 0.55 7.58C0.48 6.93 0.48 6.1 0.48 5.03V5.03V4.97V4.97C0.48 3.9 0.48 3.07 0.55 2.42C0.63 1.78 0.78 1.24 1.16 0.85C1.45 0.57 1.8 0.36 2.19 0.25C2.71 0.1 3.25 0.23 3.85 0.48C4.44 0.73 5.21 1.17 6.13 1.7L6.13 1.7Z"
		fill="currentColor"
	/>
</svg>
