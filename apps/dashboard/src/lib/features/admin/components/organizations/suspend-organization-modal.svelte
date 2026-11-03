<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { AdminOrganization } from '@snapflow/api-client';
import * as z from 'zod';
import type { AdminOrganizationSuspension } from '#lib/api/admin/organizations.ts';
import {
	durationMinuteOptions,
	MINIMUM_DURATION_MINUTES,
} from '#lib/features/admin/lib/admin-duration-options.ts';

const MILLISECONDS_PER_MINUTE = 60_000;
const SUSPENSION_DURATION_OPTIONS = durationMinuteOptions('Until unsuspended');
const WHOLE_NUMBER_PATTERN = /^\d+$/;

const suspensionSchema = z.object({
	reason: z.string().trim().min(1, 'A reason is required'),
	durationMinutes: z
		.string()
		.refine(
			(value) => value === '' || Number(value) >= MINIMUM_DURATION_MINUTES,
			'Enter at least one minute'
		),
	cleanupGracePeriodHours: z
		.string()
		.trim()
		.refine(
			(value) => value === '' || WHOLE_NUMBER_PATTERN.test(value),
			'Enter a whole number of hours'
		),
});

const EMPTY_SUSPENSION = {
	reason: '',
	durationMinutes: '',
	cleanupGracePeriodHours: '',
};

interface SuspendOrganizationModalProps {
	organization: AdminOrganization | null;
	pending: boolean;
	onSuspend: (suspension: AdminOrganizationSuspension) => Promise<unknown>;
	onClose: () => void;
}
</script>

<script lang="ts">
import { revalidateLogic } from '@tanstack/svelte-form';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import {
	formSubmitHandler,
	submitMutation,
} from '#lib/components/form/submit.ts';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';

let {
	organization,
	pending,
	onSuspend,
	onClose,
}: SuspendOrganizationModalProps = $props();

const form = createAppForm(() => ({
	defaultValues: EMPTY_SUSPENSION,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: suspensionSchema },
	onSubmit: async ({ value }) => {
		if (!organization) return;
		const suspended = organization;
		const gracePeriod = value.cleanupGracePeriodHours.trim();
		const submitted = await submitMutation(() =>
			onSuspend({
				organization: suspended,
				suspension: {
					reason: value.reason.trim(),
					until: value.durationMinutes
						? new Date(
								Date.now() +
									Number(value.durationMinutes) * MILLISECONDS_PER_MINUTE
							).toISOString()
						: undefined,
					cleanupGracePeriodHours: gracePeriod
						? Number(gracePeriod)
						: undefined,
				},
			})
		);
		if (submitted) form.reset();
	},
}));

function setOpen(open: boolean) {
	if (open) return;
	form.reset();
	onClose();
}
</script>

<form.Subscribe
	selector={(state) => [state.canSubmit, state.isSubmitting] as const}
>
	{#snippet children([canSubmit, isSubmitting])}
		{const busy = $derived(pending || isSubmitting)}
		<ChipModalConfirm
			bind:open={() => organization !== null, setOpen}
			title="Suspend organization"
			text={[
				'Suspending ',
				{ text: organization?.name ?? 'this organization', bold: true },
				' ',
				{
					text: 'rejects every change its members make until the suspension ends.',
					error: true,
				},
				' Members keep read access.',
			]}
			pending={busy}
			onsubmit={formSubmitHandler(form)}
		>
			{#snippet confirm()}
				<ChipModalAction
					type="submit"
					variant="destructive"
					disabled={!canSubmit || busy}
				>
					{busy ? 'Suspending...' : 'Suspend'}
				</ChipModalAction>
			{/snippet}
			<form.AppField name="reason">
				{#snippet children(
					field
				)}
					<field.TextareaField
						label="Reason"
						placeholder="Shown to the members of the organization"
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="durationMinutes">
				{#snippet children(
					field
				)}
					<field.DurationField
						label="Duration"
						minimum={MINIMUM_DURATION_MINUTES}
						options={SUSPENSION_DURATION_OPTIONS}
					/>
				{/snippet}
			</form.AppField>
			<form.AppField name="cleanupGracePeriodHours">
				{#snippet children(
					field
				)}
					<field.TextField
						label="Cleanup grace period"
						hint="Hours"
						inputmode="numeric"
						placeholder="Platform default"
					/>
				{/snippet}
			</form.AppField>
		</ChipModalConfirm>
	{/snippet}
</form.Subscribe>
