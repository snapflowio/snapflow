<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { AUTH_CODE_LENGTH } from '#lib/features/auth/lib/auth-security.ts';

const STEP_UP_METHOD = {
	TOTP: 'totp',
	BACKUP_CODE: 'backup-code',
} as const;

type StepUpMethod = (typeof STEP_UP_METHOD)[keyof typeof STEP_UP_METHOD];

const STEP_UP_CODE_INPUT_ID = 'admin-step-up-code';

const NON_DIGITS = /\D/g;

const CODE_FIELD_COPY = {
	totp: {
		inputMode: 'numeric',
		label: 'Authenticator code',
		maxLength: AUTH_CODE_LENGTH,
		placeholder: '000000',
		toggle: 'Use a recovery code',
	},
	recovery: {
		inputMode: 'text',
		label: 'Recovery code',
		maxLength: undefined,
		placeholder: 'Enter a recovery code',
		toggle: 'Use an authenticator code',
	},
} as const;
</script>

<script lang="ts">
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import { SECURITY_SETTINGS_LINK } from '#lib/api/admin/mfa.ts';
import { adminMfaStepUp } from '#lib/api/admin/mfa-step-up.svelte.ts';
import { signInWithPasskey } from '#lib/api/auth/sign-in.ts';
import {
	verifyBackupCodeStepUp,
	verifyTotpStepUp,
} from '#lib/api/auth/two-factor.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { supportsPasskeys } from '#lib/features/auth/lib/sign-in/passkey-support.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';

const auth = getAuth();
const passkeysSupported = supportsPasskeys();
let method = $state<StepUpMethod>(STEP_UP_METHOD.TOTP);
let code = $state('');
let errorMessage = $state<string | null>(null);
let pending = $state(false);
const hasAuthenticator = $derived(auth.user?.twoFactorEnabled === true);
const isTotp = $derived(method === STEP_UP_METHOD.TOTP);
const codeReady = $derived(
	isTotp ? code.length === AUTH_CODE_LENGTH : code.trim().length > 0
);
const copy = $derived(isTotp ? CODE_FIELD_COPY.totp : CODE_FIELD_COPY.recovery);

async function verifyWith(operation: () => Promise<unknown>) {
	errorMessage = null;
	pending = true;
	try {
		await operation();
		await auth.refetch();
		adminMfaStepUp.settle(true);
	} catch (verificationError) {
		errorMessage = SnapflowError.fromUnknown(verificationError).message;
	} finally {
		pending = false;
	}
}

const verifyCode = () =>
	verifyWith(() =>
		isTotp ? verifyTotpStepUp(code) : verifyBackupCodeStepUp(code.trim())
	);

const verifyPasskey = () => verifyWith(signInWithPasskey);

const cancel = () => adminMfaStepUp.settle(false);

function toggleMethod() {
	method = isTotp ? STEP_UP_METHOD.BACKUP_CODE : STEP_UP_METHOD.TOTP;
	code = '';
	errorMessage = null;
}

function setCode(nextCode: string) {
	code = isTotp ? nextCode.replace(NON_DIGITS, '') : nextCode;
}
</script>

<ChipModal
	open
	onOpenChange={(nextOpen) => !nextOpen && cancel()}
	onsubmit={() => void verifyCode()}
	size="sm"
	srTitle="Verify it’s you"
	dismissDisabled={pending}
>
	<ChipModalHeader icon={ShieldCheck} onClose={cancel} closeDisabled={pending}>
		Verify it’s you
	</ChipModalHeader>
	<ChipModalBody>
		<p class="wrap-break-word px-2 text-(--text-primary) text-sm">
			Administrator actions need a session verified with an authenticator app or
			a passkey.
		</p>
		{#if hasAuthenticator}
			<ChipModalField
				label={copy.label}
				for={STEP_UP_CODE_INPUT_ID}
				error={errorMessage}
			>
				{#snippet labelAccessory()}
					<button
						type="button"
						class="cursor-pointer text-(--text-muted) text-caption outline-none transition-colors hover-hover:text-(--text-body) focus-visible:text-(--text-body)"
						onclick={toggleMethod}
					>
						{copy.toggle}
					</button>
				{/snippet}
				<ChipInput
					id={STEP_UP_CODE_INPUT_ID}
					bind:value={() => code, setCode}
					autocomplete="one-time-code"
					inputmode={copy.inputMode}
					maxlength={copy.maxLength}
					placeholder={copy.placeholder}
					error={Boolean(errorMessage)}
				/>
			</ChipModalField>
		{:else}
			<p class="px-2 text-(--text-muted) text-caption">
				No authenticator app is set up for this account. Use a passkey, or
				<a
					href={SECURITY_SETTINGS_LINK.to}
					onclick={cancel}
					class="text-(--text-body) underline underline-offset-4 hover-hover:text-(--text-primary)"
					>set one up in account security</a
				>.
			</p>
			<ChipModalError message={errorMessage} />
		{/if}
	</ChipModalBody>
	<ChipModalFooter onCancel={cancel} cancelDisabled={pending}>
		{#snippet primaryAdjacentAction()}
			{#if passkeysSupported}
				<Chip disabled={pending} onclick={() => void verifyPasskey()}>
					Use passkey
				</Chip>
			{/if}
		{/snippet}
		{#snippet primaryAction(
			initialFocus
		)}
			<ChipModalAction
				type="submit"
				variant="primary"
				disabled={pending || !hasAuthenticator || !codeReady}
				{@attach initialFocus}
			>
				{pending ? 'Verifying...' : 'Verify'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
