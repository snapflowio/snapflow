<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { revokeOtherSessionsMutationOptions } from '#lib/api/account/sessions.ts';
import { SIGN_OUT_FAILED_MESSAGE, signOut } from '#lib/api/auth/session.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import DeleteAccountSettings from '#lib/features/account/components/delete-account-settings.svelte';
import PasskeySettings from '#lib/features/account/components/passkey-settings.svelte';
import ProfileSection from '#lib/features/account/components/profile-section.svelte';
import SessionSettings from '#lib/features/account/components/session-settings.svelte';
import TwoFactorSettings from '#lib/features/account/components/two-factor/two-factor-settings.svelte';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const queryClient = useQueryClient();
const revokeOthers = createMutation(() => revokeOtherSessionsMutationOptions());
let signOutOthersOpen = $state(false);

async function signOutOfAccount(): Promise<void> {
	try {
		await signOut(queryClient);
	} catch (error) {
		showApiError(error, SIGN_OUT_FAILED_MESSAGE);
		return;
	}
	await goto(resolve(Path.LOGIN), { replace: true });
}

function signOutOtherDevices(): void {
	revokeOthers.mutate(undefined, {
		onSuccess: () => {
			signOutOthersOpen = false;
		},
	});
}
</script>

<SettingsPage
	title="Account"
	description="Your profile, sign-in methods and sessions."
	actions={[
		{
			id: 'sign-out',
			label: 'Sign out',
			onSelect: () => void signOutOfAccount(),
		},
		{
			id: 'sign-out-other-devices',
			label: 'Sign out other devices',
			onSelect: () => (signOutOthersOpen = true),
		},
	]}
>
	<ProfileSection />
	<PasskeySettings />
	<TwoFactorSettings />
	<SessionSettings />
	<DeleteAccountSettings />
</SettingsPage>

<ChipModalConfirm
	bind:open={signOutOthersOpen}
	onsubmit={signOutOtherDevices}
	title="Sign out other devices"
	text="This device stays signed in."
	pending={revokeOthers.isPending}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={revokeOthers.isPending}
		>
			{revokeOthers.isPending ? 'Signing out...' : 'Sign out'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
