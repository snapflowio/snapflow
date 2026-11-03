<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';

interface DetailsCopyRowProps {
	label: string;
	value: string;
}

let { label, value }: DetailsCopyRowProps = $props();

const clipboard = new CopyToClipboard();
</script>

<div
	class="relative flex h-10 min-w-0 items-center justify-between gap-4 px-3 transition-colors hover-hover:bg-surface-active has-focus-visible:bg-surface-active"
>
	<dt class="shrink-0 text-(--text-tertiary) text-caption">{label}</dt>
	<dd class="min-w-0">
		<button
			type="button"
			aria-label={`Copy ${label}`}
			onclick={() => void clipboard.copy(value)}
			class="block max-w-full cursor-pointer truncate font-mono text-(--text-secondary) text-caption outline-none after:absolute after:inset-0 after:content-['']"
		>
			{clipboard.copied ? 'Copied!' : value}
		</button>
	</dd>
</div>
