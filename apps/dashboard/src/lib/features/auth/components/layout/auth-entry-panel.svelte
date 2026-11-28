<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { Path } from '#lib/routing/paths.ts';

const ENTRY_COPY = {
	'sign-in': {
		title: 'Sign in',
		description: 'Enter your details',
		submitLabel: 'Sign in',
		prompt: "Don't have an account?",
		linkLabel: 'Sign up',
		crossPath: Path.SIGNUP,
		consentAtButtons: false,
	},
	'sign-up': {
		title: 'Create an account',
		description: 'Get started with Snapflow',
		submitLabel: 'Create account',
		prompt: 'Already have an account?',
		linkLabel: 'Sign in',
		crossPath: Path.LOGIN,
		consentAtButtons: true,
	},
} as const;

type AuthEntryMode = keyof typeof ENTRY_COPY;

interface AuthEntryPanelProps {
	mode: AuthEntryMode;
	returnTo: string | null;
	signedInTo?: string;
	errorCode?: string | undefined;
	errorDescription?: string | undefined;
}

function socialErrorMessage(
	code: string,
	description: string | undefined
): string {
	return description ?? `Sign-in failed: ${code.replaceAll('_', ' ')}`;
}
</script>

<script lang="ts">
import { getPublicConfig } from '#lib/api/public-config.ts';
import AuthAlternativeSignIn from '#lib/features/auth/components/sign-in/auth-alternative-sign-in.svelte';
import AuthEmailOtpForm, {
	type EmailOtpStage,
} from '#lib/features/auth/components/sign-in/auth-email-otp-form.svelte';
import {
	authEntryHref,
	normalizeAuthReturnTo,
} from '#lib/features/auth/lib/auth-return-to.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { HumanVerification } from '#lib/features/auth/state/human-verification.svelte.ts';
import LegalConsentLine from '#lib/features/legal/components/legal-consent-line.svelte';
import AuthFormMessage from './auth-form-message.svelte';
import AuthHeader from './auth-header.svelte';
import AuthNavPrompt from './auth-nav-prompt.svelte';

let {
	errorCode,
	errorDescription,
	mode,
	returnTo,
	signedInTo,
}: AuthEntryPanelProps = $props();

const auth = getAuth();
const humanVerification = new HumanVerification(
	getPublicConfig().humanVerification
);
const target = $derived(signedInTo ?? normalizeAuthReturnTo(returnTo));
const copy = $derived(ENTRY_COPY[mode]);
const authenticated = $derived(Boolean(auth.user));

let stage = $state<EmailOtpStage>('email');
let email = $state('');
</script>

{#snippet submitConsent()}
	<LegalConsentLine action={`clicking ${copy.submitLabel}`} />
{/snippet}

<div>
	<div class="flex flex-col gap-8">
		{#if stage === 'email'}
			<AuthHeader title={copy.title} description={copy.description} />
		{:else if stage === 'code'}
			<AuthHeader
				title="Verify your email"
				description={`A verification code has been sent to ${email.trim() || 'your email'}`}
			/>
		{:else}
			<AuthHeader
				title="Email verified"
				description="Your email has been verified. Redirecting..."
			/>
		{/if}
		<div class="flex flex-col gap-y-4">
			{#if stage === 'email'}
				{#if errorCode}
					<AuthFormMessage type="error">
						{socialErrorMessage(errorCode, errorDescription)}
					</AuthFormMessage>
				{/if}
				<AuthAlternativeSignIn
					onSignedIn={auth.refetch}
					returnTo={target}
					socialConsent={copy.consentAtButtons}
				/>
			{/if}
			<AuthEmailOtpForm
				bind:stage
				bind:email
				{humanVerification}
				collectName={mode === 'sign-up'}
				submitLabel={copy.submitLabel}
				disabled={authenticated}
				onSignedIn={auth.refetch}
				legal={copy.consentAtButtons ? submitConsent : undefined}
			/>
		</div>
		{#if stage === 'email'}
			{#if !copy.consentAtButtons}
				<LegalConsentLine action="signing in" />
			{/if}
			<AuthNavPrompt
				prompt={copy.prompt}
				href={authEntryHref(copy.crossPath, returnTo)}
				linkLabel={copy.linkLabel}
			/>
		{/if}
	</div>
	<div
		class={humanVerification.interactive ? 'mt-6' : undefined}
		{@attach humanVerification.widget}
	></div>
</div>
