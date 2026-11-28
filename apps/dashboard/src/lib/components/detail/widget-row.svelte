<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';

interface WidgetRowProps {
	label?: string;
	children: Snippet;
}

let { label, children }: WidgetRowProps = $props();
</script>

<section
	aria-label={label}
	class="@container/widgets overflow-hidden rounded-xl border border-border"
>
	<div
		class="-mr-px -mb-px grid grid-cols-1 @3xl/widgets:grid-cols-3 [&>*]:border-border [&>*]:border-r [&>*]:border-b"
	>
		{@render children()}
	</div>
</section>
