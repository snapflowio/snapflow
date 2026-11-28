<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const DEFAULT_SNIPPET = 'ssh';
</script>

<script lang="ts">
import Plug from '@lucide/svelte/icons/plug';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { chipFieldSurfaceClass } from '#lib/components/ui/chip/chip-chrome.ts';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import CopyCodeButton from '#lib/components/ui/clipboard/copy-code-button.svelte';
import Popover from '#lib/components/ui/popover/popover.svelte';
import PopoverContent from '#lib/components/ui/popover/popover-content.svelte';
import PopoverTrigger from '#lib/components/ui/popover/popover-trigger.svelte';
import { sandboxConnectSnippets } from '#lib/features/sandboxes/lib/sandbox-connect.ts';
import { resolve } from '$app/paths';
import { page } from '$app/state';

interface SandboxConnectPopoverProps {
	sandboxId: string;
}

let { sandboxId }: SandboxConnectPopoverProps = $props();

let selected = $state(DEFAULT_SNIPPET);
const snippets = $derived(sandboxConnectSnippets(sandboxId, page.url.origin));
const options = $derived(
	snippets.map((snippet) => ({ value: snippet.id, label: snippet.label }))
);
const snippet = $derived(
	snippets.find((candidate) => candidate.id === selected) ?? snippets[0]
);
const networkingHref = $derived(
	resolve('/(app)/(dashboard)/sandboxes/[sandboxId]/networking', {
		sandboxId,
	})
);
</script>

<Popover>
	<PopoverTrigger>
		{#snippet child({ props })}
			<Chip {...props} leftIcon={Plug} mobileIconOnly>Connect</Chip>
		{/snippet}
	</PopoverTrigger>
	<PopoverContent
		align="start"
		mobileSheet
		class="flex w-128 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4"
	>
		<div class="flex items-center justify-between gap-2">
			<ChipSwitch
				{options}
				value={selected}
				onChange={(value) => (selected = value)}
				size="compact"
				aria-label="Connection method"
			/>
			<Chip size="compact" href={networkingHref}>SSH access</Chip>
		</div>
		{#if snippet}
			<div class={['relative', chipFieldSurfaceClass]}>
				<pre
					class="max-h-56 overflow-auto py-3 pr-10 pl-3 font-mono text-(--text-body) text-xs leading-5"
				><code>{snippet.code}</code></pre>
				<div class="absolute top-1.5 right-1.5">
					<CopyCodeButton
						code={snippet.code}
						label={`Copy ${snippet.label} snippet`}
					/>
				</div>
			</div>
		{/if}
	</PopoverContent>
</Popover>
