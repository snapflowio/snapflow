<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { AdminUser } from '@snapflow/api-client';
import * as z from 'zod';
import type { AdminUserBan } from '#lib/api/admin/users.ts';
import {
	durationMinuteOptions,
	MINIMUM_DURATION_MINUTES,
} from '#lib/features/admin/lib/admin-duration-options.ts';

const SECONDS_PER_MINUTE = 60;
const BAN_DURATION_OPTIONS = durationMinuteOptions('Until unbanned');

const banSchema = z.object({
	banReason: z.string().trim().min(1, 'A reason is required'),
	durationMinutes: z
		.string()
		.refine(
			(value) => value === '' || Number(value) >= MINIMUM_DURATION_MINUTES,
			'Enter at least one minute'
		),
});

const EMPTY_BAN = { banReason: '', durationMinutes: '' };

interface BanUserModalProps {
	user: AdminUser | null;
	pending: boolean;
	onBan: (ban: AdminUserBan) => Promise<unknown>;
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

let { user, pending, onBan, onClose }: BanUserModalProps = $props();

const form = createAppForm(() => ({
	defaultValues: EMPTY_BAN,
	validationLogic: revalidateLogic(),
	validators: { onDynamic: banSchema },
	onSubmit: async ({ value }) => {
		if (!user) return;
		const banned = user;
		const submitted = await submitMutation(() =>
			onBan({
				user: banned,
				banReason: value.banReason.trim(),
				banExpiresIn: value.durationMinutes
					? Number(value.durationMinutes) * SECONDS_PER_MINUTE
					: undefined,
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
			bind:open={() => user !== null, setOpen}
			title="Ban user"
			text={[
				'Banning ',
				{ text: user?.email ?? 'this user', bold: true },
				' ',
				{
					text: 'signs them out everywhere and blocks them from signing back in.',
					error: true,
				},
				' You can unban them later.',
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
					{busy ? 'Banning...' : 'Ban'}
				</ChipModalAction>
			{/snippet}
			<form.AppField name="banReason">
				{#snippet children(
					field
				)}
					<field.TextareaField
						label="Reason"
						placeholder="Shown when they try to sign in"
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
						options={BAN_DURATION_OPTIONS}
					/>
				{/snippet}
			</form.AppField>
		</ChipModalConfirm>
	{/snippet}
</form.Subscribe>
