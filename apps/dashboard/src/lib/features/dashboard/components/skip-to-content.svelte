<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
interface SkipToContentProps {
	targetId: string;
	target: HTMLElement | undefined;
}

let { targetId, target }: SkipToContentProps = $props();

function skip(event: MouseEvent): void {
	if (!target) return;
	event.preventDefault();
	target.focus();
}
</script>

<a
	href={`#${targetId}`}
	onclick={skip}
	class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-(--z-takeover) focus:rounded-lg focus:border focus:border-border focus:bg-bg focus:px-3 focus:py-1.5 focus:text-(--text-primary) focus:text-sm focus:shadow-medium"
>
	Skip to content
</a>
