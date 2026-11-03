<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import * as z from 'zod';

const NAME_MAX_LENGTH = 100;
const RESEND_COOLDOWN_SECONDS = 30;
const COUNTDOWN_TICK_MS = 1000;
const AUTO_VERIFY_DELAY_MS = 300;
const NAME_CHARACTERS_PATTERN = /^[\p{L}\s\-']+$/u;
const CONSECUTIVE_SPACES_PATTERN = /\s\s/;
const emailSchema = z.email();

export type EmailOtpStage = 'email' | 'code' | 'verified';

interface AuthEmailOtpFormProps {
	collectName: boolean;
	disabled: boolean;
	submitLabel: string;
	onSignedIn: () => Promise<void>;
	stage?: EmailOtpStage;
	email?: string;
}

function validateName(value: string): string[] {
	const trimmed = value.trim();
	if (!trimmed) return ['Name is required.'];
	const errors: string[] = [];
	if (!NAME_CHARACTERS_PATTERN.test(trimmed)) {
		errors.push(
			'Name can only contain letters, spaces, hyphens, and apostrophes.'
		);
	}
	if (CONSECUTIVE_SPACES_PATTERN.test(value)) {
		errors.push('Name cannot contain consecutive spaces.');
	}
	if (trimmed.length > NAME_MAX_LENGTH) {
		errors.push(
			`Name must be ${NAME_MAX_LENGTH} characters or fewer. Please shorten your name.`
		);
	}
	return errors;
}

function validateEmail(value: string): string[] {
	const trimmed = value.trim();
	if (!trimmed) return ['Email is required.'];
	if (!emailSchema.safeParse(trimmed).success) {
		return ['Please enter a valid email address.'];
	}
	return [];
}
</script>

<script lang="ts">
import { sendSignInOtp, signInWithEmailOtp } from '#lib/api/auth/sign-in.ts';
import AuthFormMessage from '#lib/features/auth/components/layout/auth-form-message.svelte';
import AuthNavPrompt from '#lib/features/auth/components/layout/auth-nav-prompt.svelte';
import { authErrorMessage } from '#lib/features/auth/lib/auth-error-message.ts';
import { AUTH_CODE_LENGTH } from '#lib/features/auth/lib/auth-security.ts';
import { LOGIN_METHOD } from '#lib/features/auth/lib/sign-in/login-method.ts';
import AuthField from './auth-field.svelte';
import AuthInput from './auth-input.svelte';
import AuthLastUsedBadge from './auth-last-used-badge.svelte';
import AuthOtpInput from './auth-otp-input.svelte';
import AuthSubmitButton from './auth-submit-button.svelte';
import AuthTextLink from './auth-text-link.svelte';

let {
	collectName,
	disabled,
	submitLabel,
	onSignedIn,
	stage = $bindable('email'),
	email = $bindable(''),
}: AuthEmailOtpFormProps = $props();

let name = $state('');
let code = $state('');
let errorMessage = $state<string | null>(null);
let pending = $state(false);
let resending = $state(false);
let countdown = $state(0);
let showFieldErrors = $state(false);
const nameErrors = $derived(
	showFieldErrors && collectName ? validateName(name) : []
);
const emailErrors = $derived(showFieldErrors ? validateEmail(email) : []);
const canSubmit = $derived(
	email.trim().length > 0 && (!collectName || name.trim().length > 0)
);
const codeComplete = $derived(code.length === AUTH_CODE_LENGTH);
const busy = $derived(disabled || pending || resending);

$effect(() => {
	if (countdown <= 0) return;
	const timer = setTimeout(() => {
		countdown -= 1;
	}, COUNTDOWN_TICK_MS);
	return () => clearTimeout(timer);
});

$effect(() => {
	if (stage !== 'code' || !codeComplete || busy) return;
	errorMessage = null;
	const timer = setTimeout(() => void verifyCode(), AUTO_VERIFY_DELAY_MS);
	return () => clearTimeout(timer);
});

async function requestCode(): Promise<void> {
	await sendSignInOtp(email.trim());
	countdown = RESEND_COOLDOWN_SECONDS;
}

async function sendCode() {
	showFieldErrors = true;
	if (nameErrors.length > 0 || emailErrors.length > 0) return;
	errorMessage = null;
	pending = true;
	try {
		await requestCode();
		code = '';
		showFieldErrors = false;
		stage = 'code';
	} catch (sendError) {
		errorMessage = authErrorMessage(sendError);
	} finally {
		pending = false;
	}
}

async function resendCode() {
	errorMessage = null;
	resending = true;
	try {
		await requestCode();
	} catch {
		errorMessage =
			'Failed to resend verification code. Please try again later.';
	} finally {
		resending = false;
	}
}

async function verifyCode() {
	if (!codeComplete || pending) return;
	errorMessage = null;
	pending = true;
	try {
		await signInWithEmailOtp({
			email: email.trim(),
			otp: code,
			name: collectName ? name.trim() : undefined,
		});
		stage = 'verified';
		await onSignedIn();
	} catch (verifyError) {
		errorMessage = authErrorMessage(verifyError);
		code = '';
		stage = 'code';
	} finally {
		pending = false;
	}
}

function submit(event: SubmitEvent) {
	event.preventDefault();
	void (stage === 'email' ? sendCode() : verifyCode());
}

function useDifferentEmail() {
	stage = 'email';
	code = '';
	countdown = 0;
	errorMessage = null;
}
</script>

{#if stage === 'email'}
	<form novalidate onsubmit={submit} class="space-y-6">
		<div class="space-y-5">
			{#if collectName}
				<AuthField id="name" label="Full name" errors={nameErrors}>
					<AuthInput
						id="name"
						name="name"
						autocapitalize="words"
						autocomplete="name"
						placeholder="Enter your name"
						title="Name can only contain letters, spaces, hyphens, and apostrophes"
						error={nameErrors.length > 0}
						oninput={() => (showFieldErrors = false)}
						bind:value={name}
					/>
				</AuthField>
			{/if}
			<AuthField id="email" label="Email" errors={emailErrors}>
				{#snippet action()}
					<AuthLastUsedBadge method={LOGIN_METHOD.EMAIL_OTP} />
				{/snippet}
				<AuthInput
					id="email"
					name="email"
					type="email"
					autocapitalize="none"
					autocomplete="email webauthn"
					spellcheck={false}
					placeholder="Enter your email"
					error={emailErrors.length > 0 || Boolean(errorMessage)}
					oninput={() => (showFieldErrors = false)}
					bind:value={email}
				/>
			</AuthField>
		</div>
		{#if errorMessage}
			<AuthFormMessage type="error">{errorMessage}</AuthFormMessage>
		{/if}
		<AuthSubmitButton
			loading={pending}
			loadingLabel="Sending code..."
			disabled={disabled || !canSubmit}
		>
			{submitLabel}
		</AuthSubmitButton>
	</form>
{:else if stage === 'code'}
	<form novalidate onsubmit={submit} class="space-y-6">
		<div class="space-y-5">
			<p class="text-center text-(--text-muted) text-sm">
				Enter the {AUTH_CODE_LENGTH}-digit code to continue. If you don't see it
				in your inbox, check your spam folder.
			</p>
			<AuthOtpInput
				id="email-code"
				name="code"
				label={`${AUTH_CODE_LENGTH}-digit verification code`}
				disabled={pending || resending}
				invalid={Boolean(errorMessage)}
				bind:value={code}
			/>
			{#if errorMessage}
				<AuthFormMessage type="error" align="center">
					{errorMessage}
				</AuthFormMessage>
			{/if}
		</div>
		<AuthSubmitButton
			loading={pending || resending}
			loadingLabel="Verifying..."
			disabled={disabled || !codeComplete}
		>
			Verify email
		</AuthSubmitButton>
		<p class="text-center text-(--text-muted) text-sm">
			Didn't receive a code?
			{#if countdown > 0}
				<span>
					Resend in <span class="text-(--text-primary)">{countdown}s</span>
				</span>
			{:else}
				<AuthTextLink disabled={busy} onclick={() => void resendCode()}>
					Resend
				</AuthTextLink>
			{/if}
		</p>
		<AuthNavPrompt
			linkLabel="Use a different email"
			disabled={pending}
			onSelect={useDifferentEmail}
		/>
	</form>
{/if}
