<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { saveDiscardActions } from '#lib/components/page/header-actions.ts';
import PageColumn from '#lib/components/page/page-column.svelte';
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import UnsavedChangesGuard from '#lib/components/settings/unsaved-changes-guard.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipInputSuffix from '#lib/components/ui/chip/chip-input-suffix.svelte';
import ChipTimePicker from '#lib/components/ui/chip/chip-time-picker.svelte';
import Switch from '#lib/components/ui/switch.svelte';
import {
	DEFAULT_MAINTENANCE_WINDOW_LABEL,
	DEFAULT_UNCLAIMED_FLOAT_AMOUNT,
	DEFAULT_UNCLAIMED_FLOAT_LABEL,
	DEFAULT_WINDOW_START_LABEL,
	OFFER_FIELDS,
} from '#lib/features/machines/lib/host-settings.ts';
import { machineLargestGuestMemoryGiB } from '#lib/features/machines/lib/machine-format.ts';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';
import { MachineHostSettingsEditor } from '#lib/features/machines/state/machine-host-settings.svelte.ts';
import { formatCount } from '#lib/utils/format.ts';

const SETTINGS_FORM_ID = 'machine-host-settings';

const detail = getMachineDetail();
const editor = new MachineHostSettingsEditor();
const machine = $derived(detail.machine);
const disabled = $derived(!editor.canWrite || editor.saving);
const writeReason = $derived(
	editor.canWrite ? undefined : 'Ask a member who manages machines'
);
const machineCapacity = $derived({
	vcpus: machine.cpu,
	memoryGiB: machineLargestGuestMemoryGiB(machine),
	diskGiB: machine.disk,
});
const windowInEffect = $derived(machine.updateStatus?.maintenanceWindow);

detail.usePageActions(() =>
	editor.canWrite
		? saveDiscardActions({
				dirty: editor.dirty,
				saving: editor.saving,
				onDiscard: editor.discard,
				form: SETTINGS_FORM_ID,
			}).map((action) =>
				action.id === 'save' ? { ...action, disabled: !editor.ready } : action
			)
		: []
);

function submit(event: SubmitEvent): void {
	event.preventDefault();
	editor.save();
}
</script>

{#snippet minutesSuffix()}
	<ChipInputSuffix>minutes</ChipInputSuffix>
{/snippet}

{#snippet usdcSuffix()}
	<ChipInputSuffix>USDC</ChipInputSuffix>
{/snippet}

<PageColumn width="settings">
	<form
		id={SETTINGS_FORM_ID}
		class="flex w-full flex-col gap-8"
		onsubmit={submit}
	>
		<SettingsSection
			title="Maintenance window"
			description="Updates install inside this daily window."
			info={windowInEffect
				? `The machine reports ${windowInEffect}.`
				: undefined}
		>
			<SettingsRow
				label="Custom window"
				description={`Off uses the default, ${DEFAULT_MAINTENANCE_WINDOW_LABEL}.`}
				disabledReason={writeReason}
			>
				{#snippet control(id)}
					<Switch
						{id}
						bind:checked={
							() => editor.draft.customWindow,
							(customWindow) => editor.edit('customWindow', customWindow)
						}
						{disabled}
					/>
				{/snippet}
			</SettingsRow>
			{#if editor.draft.customWindow}
				<SettingsRow
					label="Starts at (UTC)"
					description="When the daily window opens."
					layout="split"
				>
					{#snippet control(id)}
						<ChipTimePicker
							{id}
							bind:value={
								() => editor.draft.windowStart,
								(windowStart) => editor.edit('windowStart', windowStart)
							}
							placeholder={DEFAULT_WINDOW_START_LABEL}
							fullWidth
							{disabled}
						/>
					{/snippet}
				</SettingsRow>
				<SettingsRow
					label="Duration"
					description="How long the window stays open."
					layout="split"
					error={editor.errors.windowDuration}
				>
					{#snippet control(id)}
						<ChipInput
							{id}
							inputmode="numeric"
							bind:value={
								() => editor.draft.windowDuration,
								(windowDuration) => editor.edit('windowDuration', windowDuration)
							}
							error={Boolean(editor.errors.windowDuration)}
							aria-invalid={editor.errors.windowDuration ? true : undefined}
							endAdornment={minutesSuffix}
							{disabled}
						/>
					{/snippet}
				</SettingsRow>
			{/if}
		</SettingsSection>

		<SettingsSection
			title="Offered capacity"
			description="The most this machine offers to sandboxes. Empty offers everything it has."
		>
			{#each OFFER_FIELDS as offer (offer.key)}
				{#snippet unitSuffix()}
					<ChipInputSuffix>{offer.unit}</ChipInputSuffix>
				{/snippet}
				<SettingsRow
					label={offer.label}
					layout="split"
					error={editor.errors[offer.key]}
				>
					{#snippet control(id)}
						<ChipInput
							{id}
							inputmode="numeric"
							placeholder={`All ${formatCount(machineCapacity[offer.key])}`}
							bind:value={
								() => editor.draft[offer.key],
								(value) => editor.edit(offer.key, value)
							}
							error={Boolean(editor.errors[offer.key])}
							aria-invalid={editor.errors[offer.key] ? true : undefined}
							endAdornment={unitSuffix}
							{disabled}
						/>
					{/snippet}
				</SettingsRow>
			{/each}
		</SettingsSection>

		<SettingsSection title="Payouts">
			<SettingsRow
				label="Payout reserve"
				description="The most a renter can owe before their sandbox pauses until they pay."
				info={`Empty uses the default, ${DEFAULT_UNCLAIMED_FLOAT_LABEL}.`}
				layout="split"
				error={editor.errors.maxUnclaimedFloat}
			>
				{#snippet control(id)}
					<ChipInput
						{id}
						inputmode="decimal"
						placeholder={DEFAULT_UNCLAIMED_FLOAT_AMOUNT}
						bind:value={
							() => editor.draft.maxUnclaimedFloat,
							(value) => editor.edit('maxUnclaimedFloat', value)
						}
						error={Boolean(editor.errors.maxUnclaimedFloat)}
						aria-invalid={editor.errors.maxUnclaimedFloat ? true : undefined}
						endAdornment={usdcSuffix}
						{disabled}
					/>
				{/snippet}
			</SettingsRow>
		</SettingsSection>
	</form>
</PageColumn>
<UnsavedChangesGuard dirty={editor.dirty} onDiscard={editor.discard} />
