<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { SVGAttributes } from 'svelte/elements';

const DEFAULT_SIZE = 32;

interface BrandMarkProps
	extends Omit<SVGAttributes<SVGSVGElement>, 'height' | 'width'> {
	size?: number | string;
}

let { size = DEFAULT_SIZE, ...props }: BrandMarkProps = $props();
</script>

<svg
	aria-hidden="true"
	focusable="false"
	viewBox="0 0 32 32"
	fill="currentColor"
	width={size}
	height={size}
	{...props}
>
	<rect x="4" y="4" width="14" height="6" rx="3" />
	<rect x="22" y="4" width="6" height="14" rx="3" />
	<rect x="14" y="22" width="14" height="6" rx="3" />
	<rect x="4" y="14" width="6" height="14" rx="3" />
</svg>
