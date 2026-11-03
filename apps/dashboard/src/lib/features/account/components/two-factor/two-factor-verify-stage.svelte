<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { toCanvas } from 'qrcode';
import type { Attachment } from 'svelte/attachments';
import * as z from 'zod';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { AUTH_CODE_LENGTH } from '#lib/features/auth/lib/auth-security.ts';

const QR_CODE_SIZE_PX = 160;
const QR_CODE_ERROR_CORRECTION = 'M';
const QR_CODE_MARGIN = 0;
const TOTP_SECRET_PARAM = 'secret';

const VERIFICATION_CODE_PATTERN = new RegExp(`^\\d{${AUTH_CODE_LENGTH}}$`);
const verificationCodeSchema = z.object({
	code: z
		.string()
		.regex(VERIFICATION_CODE_PATTERN, 'Enter the six-digit authenticator code'),
});

function getTotpSecret(uri: string): string | null {
	try {
		return new URL(uri).searchParams.get(TOTP_SECRET_PARAM);
	} catch {
		return null;
	}
}

function qrCode(uri: string): Attachment<HTMLCanvasElement> {
	return (canvas) => {
		toCanvas(canvas, uri, {
			width: QR_CODE_SIZE_PX,
			margin: QR_CODE_MARGIN,
			errorCorrectionLevel: QR_CODE_ERROR_CORRECTION,
		}).catch(() => toast.error('Could not render the QR code'));
	};
}

interface TwoFactorVerifyStageProps {
	errorMessage: string | null;
	onCancel: () => void;
	onVerify: (code: string) => Promise<void>;
	totpUri: string;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { formSubmitHandler } from '#lib/components/form/submit.ts';
import ChipCopyInput from '#lib/components/ui/chip/chip-copy-input.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';

let { errorMessage, onCancel, onVerify, totpUri }: TwoFactorVerifyStageProps =
	$props();

const secret = $derived(getTotpSecret(totpUri));
const secretId = $props.id();

const form = createAppForm(() => ({
	defaultValues: { code: '' },
	validationLogic: revalidateLogic(),
	validators: { onDynamic: verificationCodeSchema },
	onSubmit: ({ value }) => onVerify(value.code),
}));
</script>

<form class="flex min-h-0 flex-col" onsubmit={formSubmitHandler(form)}>
	<ChipModalBody>
		<ChipModalField label="Scan with your authenticator app">
			<div class="w-fit rounded-lg bg-white p-3">
				<canvas {@attach qrCode(totpUri)}></canvas>
			</div>
		</ChipModalField>
		{#if secret}
			<ChipModalField label="Or enter this setup key" for={secretId}>
				<ChipCopyInput
					id={secretId}
					value={secret}
					copyLabel="Copy setup key"
					class="font-mono"
				/>
			</ChipModalField>
		{/if}
		<form.AppField name="code">
			{#snippet children(
				field
			)}
				<field.TextField
					id="two-factor-verification-code"
					label="Authenticator code"
					autocomplete="one-time-code"
					inputmode="numeric"
					placeholder="000000"
					maxlength={AUTH_CODE_LENGTH}
				/>
			{/snippet}
		</form.AppField>
		<ChipModalError message={errorMessage} />
	</ChipModalBody>
	<form.Subscribe
		selector={(state) => [state.canSubmit, state.isSubmitting] as const}
	>
		{#snippet children([canSubmit, isSubmitting])}
			<ChipModalFooter {onCancel} cancelDisabled={isSubmitting}>
				{#snippet primaryAction()}
					<ChipModalAction
						type="submit"
						variant="primary"
						disabled={!canSubmit || isSubmitting}
					>
						{isSubmitting ? 'Verifying...' : 'Verify'}
					</ChipModalAction>
				{/snippet}
			</ChipModalFooter>
		{/snippet}
	</form.Subscribe>
</form>
