<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { TwoFactorAction } from './two-factor-confirm-stage.svelte';

type TwoFactorDialog =
	| { stage: 'confirm'; action: TwoFactorAction }
	| { stage: 'verify'; totpUri: string; backupCodes: readonly string[] }
	| { stage: 'recovery'; codes: readonly string[] };

const CONFIRM_TITLES: Record<TwoFactorAction, string> = {
	enable: 'Set up two-factor',
	disable: 'Turn off two-factor',
	regenerate: 'Regenerate recovery codes',
};

function twoFactorDialogTitle(dialog: TwoFactorDialog | null): string {
	if (dialog === null) return CONFIRM_TITLES.enable;
	if (dialog.stage === 'verify') return 'Set up authenticator app';
	if (dialog.stage === 'recovery') return 'Your recovery codes';
	return CONFIRM_TITLES[dialog.action];
}
</script>

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import ShieldOff from '@lucide/svelte/icons/shield-off';
import {
	disableTwoFactor,
	enableTwoFactor,
	generateBackupCodes,
	TOTP_METHOD,
	verifyTotp,
} from '#lib/api/auth/two-factor.ts';
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import DropdownMenuSeparator from '#lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import TwoFactorConfirmStage from './two-factor-confirm-stage.svelte';
import TwoFactorRecoveryCodesStage from './two-factor-recovery-codes-stage.svelte';
import TwoFactorVerifyStage from './two-factor-verify-stage.svelte';

const auth = getAuth();
let dialog = $state.raw<TwoFactorDialog | null>(null);
let errorMessage = $state<string | null>(null);
const enabled = $derived(auth.user?.twoFactorEnabled === true);
const dialogHeading = $derived(twoFactorDialogTitle(dialog));

function closeDialog(): void {
	dialog = null;
	errorMessage = null;
}

function beginAction(action: TwoFactorAction): void {
	errorMessage = null;
	dialog = { stage: 'confirm', action };
}

async function enable(): Promise<void> {
	const result = await enableTwoFactor();
	if (result.error) {
		errorMessage = userErrorMessage(result.error);
		return;
	}
	if (result.data.method !== TOTP_METHOD) {
		errorMessage = 'The server returned an unsupported two-factor setup method';
		return;
	}
	dialog = {
		stage: 'verify',
		totpUri: result.data.totpURI,
		backupCodes: result.data.backupCodes,
	};
}

async function disable(): Promise<void> {
	const result = await disableTwoFactor();
	if (result.error) {
		errorMessage = userErrorMessage(result.error);
		return;
	}
	await auth.refetch();
	closeDialog();
	toast.success('Two-factor authentication disabled');
}

async function regenerate(): Promise<void> {
	const result = await generateBackupCodes();
	if (result.error) {
		errorMessage = userErrorMessage(result.error);
		return;
	}
	dialog = { stage: 'recovery', codes: result.data.backupCodes };
}

const ACTIONS: Record<TwoFactorAction, () => Promise<void>> = {
	enable,
	disable,
	regenerate,
};

async function confirmAction(action: TwoFactorAction): Promise<void> {
	errorMessage = null;
	await ACTIONS[action]();
}

async function verify(code: string, backupCodes: readonly string[]) {
	errorMessage = null;
	const result = await verifyTotp(code);
	if (result.error) {
		errorMessage = userErrorMessage(result.error);
		return;
	}
	await auth.refetch();
	dialog = { stage: 'recovery', codes: backupCodes };
	toast.success('Two-factor authentication enabled');
}
</script>

<SettingsSection title="Two-factor">
	<SettingsRow
		label="Authenticator app"
		description="Ask for a one-time code from an authenticator app at sign-in."
	>
		<div class="flex shrink-0 items-center gap-3">
			<Badge size="sm" variant={enabled ? 'success' : 'neutral'}>
				{enabled ? 'Enabled' : 'Disabled'}
			</Badge>
			{#if enabled}
				<DropdownMenu>
					<DropdownMenuTrigger>
						{#snippet child({ props })}
							<Chip
								{...props}
								variant="secondary"
								size="compact"
								rightIcon={ChevronDown}
							>
								Manage
							</Chip>
						{/snippet}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => beginAction('regenerate')}>
							<RefreshCw />
							<span class={MENU_LABEL_CLASS}>Regenerate recovery codes</span>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							destructive
							onSelect={() => beginAction('disable')}
						>
							<ShieldOff />
							<span class={MENU_LABEL_CLASS}>Turn off</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			{:else}
				<Chip
					variant="secondary"
					size="compact"
					onclick={() => beginAction('enable')}
				>
					Set up
				</Chip>
			{/if}
		</div>
	</SettingsRow>
</SettingsSection>

<ChipModal
	bind:open={
		() => dialog !== null,
		(open) => {
	if (!open) closeDialog();
}
	}
	size={dialog?.stage === 'confirm' ? 'sm' : 'md'}
	srTitle={dialogHeading}
>
	<ChipModalHeader onClose={closeDialog}>{dialogHeading}</ChipModalHeader>
	{#if dialog?.stage === 'confirm'}
		{const action = $derived(dialog.action)}
		<TwoFactorConfirmStage
			{action}
			{errorMessage}
			onCancel={closeDialog}
			onConfirm={() => confirmAction(action)}
		/>
	{:else if dialog?.stage === 'verify'}
		{const backupCodes = $derived(dialog.backupCodes)}
		<TwoFactorVerifyStage
			totpUri={dialog.totpUri}
			{errorMessage}
			onCancel={closeDialog}
			onVerify={(code) => verify(code, backupCodes)}
		/>
	{:else if dialog?.stage === 'recovery'}
		<TwoFactorRecoveryCodesStage codes={dialog.codes} onDone={closeDialog} />
	{/if}
</ChipModal>
