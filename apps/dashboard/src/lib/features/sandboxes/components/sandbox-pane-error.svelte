<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import { cn } from '#lib/utils/utils.ts';

interface SandboxPaneErrorProps {
	message: string;
	onRetry?: () => void;
	inset?: boolean;
}

let { message, onRetry, inset = true }: SandboxPaneErrorProps = $props();
</script>

<div
	class={cn(
		'flex h-full min-h-0 w-full items-center justify-center py-8',
		inset ? 'px-4 md:px-8' : 'px-6'
	)}
>
	<FeedbackState
		class="max-w-xl"
		variant="inline"
		tone="error"
		{message}
		{onRetry}
	/>
</div>
