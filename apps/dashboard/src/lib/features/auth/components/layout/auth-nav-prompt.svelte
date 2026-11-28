<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
type AuthNavPromptTarget =
	| { href: string; onSelect?: undefined }
	| { onSelect: () => void; href?: undefined };

type AuthNavPromptProps = AuthNavPromptTarget & {
	linkLabel: string;
	prompt?: string;
	disabled?: boolean;
};
</script>

<script lang="ts">
import { AUTH_TEXT_LINK_CLASS } from '#lib/features/auth/lib/sign-in/auth-form-styles.ts';

let {
	prompt,
	href,
	onSelect,
	linkLabel,
	disabled = false,
}: AuthNavPromptProps = $props();
</script>

<p class="text-center text-(--text-subtle) text-sm">
	{#if prompt}
		{prompt}
	{/if}
	{#if href !== undefined}
		<a {href} class={AUTH_TEXT_LINK_CLASS}>{linkLabel}</a>
	{:else}
		<button
			type="button"
			{disabled}
			onclick={onSelect}
			class={AUTH_TEXT_LINK_CLASS}
		>
			{linkLabel}
		</button>
	{/if}
</p>
