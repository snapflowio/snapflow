<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { SocialProvider } from '@snapflow/api-client';
import { LOGIN_METHOD } from '#lib/features/auth/lib/sign-in/login-method.ts';

const SOCIAL_PROVIDERS = [
	{ provider: SocialProvider.Google, label: 'Google' },
	{ provider: SocialProvider.Github, label: 'GitHub' },
] as const;

type PendingMethod = SocialProvider | typeof LOGIN_METHOD.PASSKEY;

interface AuthAlternativeSignInProps {
	onSignedIn: () => Promise<void>;
	returnTo: string;
}

function absoluteUrl(path: string): string {
	return new URL(path, window.location.origin).href;
}
</script>

<script lang="ts">
import Fingerprint from '@lucide/svelte/icons/fingerprint-pattern';
import { signInWithPasskey, signInWithSocial } from '#lib/api/auth/sign-in.ts';
import { getPublicConfig } from '#lib/api/public-config.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import AuthDivider from '#lib/features/auth/components/layout/auth-divider.svelte';
import AuthFormMessage from '#lib/features/auth/components/layout/auth-form-message.svelte';
import { authErrorMessage } from '#lib/features/auth/lib/auth-error-message.ts';
import { authEntryHref } from '#lib/features/auth/lib/auth-return-to.ts';
import { AUTH_OUTLINE_BUTTON_CLASS } from '#lib/features/auth/lib/sign-in/auth-form-styles.ts';
import { supportsPasskeys } from '#lib/features/auth/lib/sign-in/passkey-support.ts';
import { Path } from '#lib/routing/paths.ts';
import AuthLastUsedBadge from './auth-last-used-badge.svelte';
import SocialProviderIcon from './social-provider-icon.svelte';

let { onSignedIn, returnTo }: AuthAlternativeSignInProps = $props();

const { socialProviders } = getPublicConfig();
const availableProviders = SOCIAL_PROVIDERS.filter(({ provider }) =>
	socialProviders.includes(provider)
);
const passkeysSupported = supportsPasskeys();
let pending = $state<PendingMethod | null>(null);
let errorMessage = $state<string | null>(null);

async function run(method: PendingMethod, operation: () => Promise<void>) {
	errorMessage = null;
	pending = method;
	try {
		await operation();
	} catch (operationError) {
		errorMessage = authErrorMessage(operationError);
	} finally {
		pending = null;
	}
}

const signInWithStoredPasskey = () =>
	run(LOGIN_METHOD.PASSKEY, async () => {
		await signInWithPasskey();
		await onSignedIn();
	});

const signInWithProvider = (provider: SocialProvider) =>
	run(provider, () =>
		signInWithSocial({
			provider,
			callbackURL: absoluteUrl(returnTo),
			errorCallbackURL: absoluteUrl(authEntryHref(Path.LOGIN, returnTo)),
		})
	);
</script>

{#if availableProviders.length > 0 || passkeysSupported}
	<AuthDivider label="Or continue with" />
	<div class="grid gap-3">
		{#each availableProviders as { provider, label } (provider)}
			<Chip
				fullWidth
				class={AUTH_OUTLINE_BUTTON_CLASS}
				disabled={pending !== null}
				onclick={() => void signInWithProvider(provider)}
			>
				{#snippet left()}
					<SocialProviderIcon {provider} />
				{/snippet}
				{#snippet right()}
					<AuthLastUsedBadge method={provider} />
				{/snippet}
				{pending === provider ? 'Connecting...' : label}
			</Chip>
		{/each}
		{#if passkeysSupported}
			<Chip
				fullWidth
				leftIcon={Fingerprint}
				class={AUTH_OUTLINE_BUTTON_CLASS}
				disabled={pending !== null}
				onclick={() => void signInWithStoredPasskey()}
			>
				{#snippet right()}
					<AuthLastUsedBadge method={LOGIN_METHOD.PASSKEY} />
				{/snippet}
				{pending === LOGIN_METHOD.PASSKEY
					? 'Waiting for passkey...'
					: 'Passkey'}
			</Chip>
		{/if}
		{#if errorMessage}
			<AuthFormMessage type="error">{errorMessage}</AuthFormMessage>
		{/if}
	</div>
{/if}
