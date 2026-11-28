<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipInput from '#lib/components/ui/chip/chip-input.svelte';
import ChipSwitch from '#lib/components/ui/chip/chip-switch.svelte';
import {
	ENROLLMENT_KEY_KIND_OPTIONS,
	ENROLLMENT_KEY_NAME_MAX_LENGTH,
	EnrollmentKeyKind,
	FLEET_LIFETIME_OPTIONS,
} from '#lib/features/machines/lib/enrollment-key.ts';
import type { MachineEnrollment } from '#lib/features/machines/state/machine-enrollment.svelte.ts';

interface EnrollmentKeyFormProps {
	enrollment: MachineEnrollment;
	onCreated: () => void;
}

let { enrollment, onCreated }: EnrollmentKeyFormProps = $props();

const formId = $props.id();

const kindInfo = $derived(
	enrollment.kind === EnrollmentKeyKind.Single
		? 'Enrolls one machine within an hour, then stops working.'
		: 'Enrolls any number of machines until it expires. Keep it secret.'
);

function submit(event: SubmitEvent): void {
	event.preventDefault();
	enrollment.submit(onCreated);
}
</script>

{#snippet createAction()}
	<Chip
		type="submit"
		form={formId}
		size="compact"
		variant="primary"
		loading={enrollment.create.isPending}
		disabled={!enrollment.ready}
	>
		Create key
	</Chip>
{/snippet}

<form id={formId} onsubmit={submit}>
	<fieldset
		class="contents"
		disabled={!enrollment.canWrite || enrollment.create.isPending}
	>
		<SettingsSection title="New key" action={createAction}>
			<SettingsRow label="Name" layout="split" error={enrollment.nameError}>
				{#snippet control(id)}
					<ChipInput
						{id}
						autocomplete="off"
						maxlength={ENROLLMENT_KEY_NAME_MAX_LENGTH}
						placeholder="office-rack"
						bind:value={enrollment.name}
						error={enrollment.nameError !== null}
					/>
				{/snippet}
			</SettingsRow>
			<SettingsRow label="Enrolls" info={kindInfo} layout="split">
				{#snippet control()}
					<ChipSwitch
						aria-label="Machines this key enrolls"
						size="compact"
						options={ENROLLMENT_KEY_KIND_OPTIONS}
						bind:value={enrollment.kind}
					/>
				{/snippet}
			</SettingsRow>
			{#if enrollment.kind === EnrollmentKeyKind.Fleet}
				<SettingsRow label="Expires after" layout="split">
					{#snippet control()}
						<ChipSwitch
							aria-label="Key lifetime"
							size="compact"
							options={FLEET_LIFETIME_OPTIONS}
							bind:value={enrollment.fleetLifetime}
						/>
					{/snippet}
				</SettingsRow>
			{/if}
		</SettingsSection>
	</fieldset>
</form>
