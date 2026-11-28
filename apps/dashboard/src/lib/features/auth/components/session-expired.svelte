<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const SIGN_OUT_DELAY_MS = 1500;
const TITLE = 'Your session expired';
const SIGNING_OUT_MESSAGE = 'Signing you out…';
</script>

<script lang="ts">
import LogOut from '@lucide/svelte/icons/log-out';
import { useQueryClient } from '@tanstack/svelte-query';
import { onMount } from 'svelte';
import { signOut } from '#lib/api/auth/session.ts';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import ErrorShell from '#lib/components/app/error-shell.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Spinner from '#lib/components/ui/spinner.svelte';

const queryClient = useQueryClient();
let signingOut = $state(true);
let failure = $state<string | null>(null);

async function leave(): Promise<void> {
	signingOut = true;
	failure = null;
	try {
		await signOut(queryClient);
	} catch (error) {
		failure = userErrorMessage(error);
	} finally {
		signingOut = false;
	}
}

onMount(() => {
	const timer = setTimeout(() => void leave(), SIGN_OUT_DELAY_MS);
	return () => clearTimeout(timer);
});
</script>

{#snippet icon()}
	{#if signingOut}
		<Spinner class="size-5.5" />
	{:else}
		<LogOut class="size-5.5" />
	{/if}
{/snippet}

<div
	role="alertdialog"
	aria-modal="true"
	aria-label={TITLE}
	class="fixed inset-0 z-(--z-takeover) flex bg-bg"
>
	<ErrorShell title={TITLE} description={failure ?? SIGNING_OUT_MESSAGE} {icon}>
		{#if failure}
			<Chip variant="primary" onclick={() => void leave()}>Try again</Chip>
		{/if}
	</ErrorShell>
</div>
