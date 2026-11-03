<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import {
	DEVICE_USER_CODE_PARAM,
	normalizeDeviceUserCode,
} from '#lib/api/auth/device.ts';
import AuthHeader from '#lib/features/auth/components/layout/auth-header.svelte';
import AuthField from '#lib/features/auth/components/sign-in/auth-field.svelte';
import AuthInput from '#lib/features/auth/components/sign-in/auth-input.svelte';
import AuthSubmitButton from '#lib/features/auth/components/sign-in/auth-submit-button.svelte';
import { Path } from '#lib/routing/paths.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

let code = $state('');
let pending = $state(false);
const userCode = $derived(normalizeDeviceUserCode(code));

async function submit(event: SubmitEvent) {
	event.preventDefault();
	if (!userCode) return;
	pending = true;
	try {
		const search = new URLSearchParams({ [DEVICE_USER_CODE_PARAM]: userCode });
		await goto(`${resolve(Path.DEVICE)}?${search}`);
	} finally {
		pending = false;
	}
}
</script>

<div class="space-y-6">
	<AuthHeader
		title="Connect your terminal"
		description="Enter the code shown in your terminal"
	/>
	<form novalidate onsubmit={submit} class="space-y-6">
		<AuthField id="device-code" label="Device code">
			<AuthInput
				id="device-code"
				name="user_code"
				autocomplete="off"
				autocapitalize="characters"
				spellcheck={false}
				placeholder="ABCD-EFGH"
				class="font-mono"
				bind:value={code}
			/>
		</AuthField>
		<AuthSubmitButton
			loading={pending}
			loadingLabel="Continuing..."
			disabled={!userCode}
		>
			Continue
		</AuthSubmitButton>
	</form>
</div>
