<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import CreditCard from '@lucide/svelte/icons/credit-card';
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import type { PaymentMethod } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import { deletePaymentMethodMutationOptions } from '#lib/api/billing/billing.ts';
import Trash from '#lib/components/icons/trash.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import { chipVariants } from '#lib/components/ui/chip/chip.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalConfirm from '#lib/components/ui/chip-modal/chip-modal-confirm.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuItem from '#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte';
import { MENU_LABEL_CLASS } from '#lib/components/ui/dropdown-menu/dropdown-menu-styles.ts';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import {
	formatCardExpiry,
	formatPaymentMethod,
} from '#lib/features/billing/lib/format.ts';

interface PaymentMethodsSectionProps {
	canManage: boolean;
	methods: readonly PaymentMethod[];
}

let { canManage, methods }: PaymentMethodsSectionProps = $props();

const remove = createMutation(() => deletePaymentMethodMutationOptions());
let removing = $state.raw<PaymentMethod | null>(null);

function confirmRemove(event: SubmitEvent) {
	event.preventDefault();
	if (!removing) return;
	remove.mutate(removing.id, {
		onSuccess: () => {
			removing = null;
		},
	});
}

function isRemoveOpen(): boolean {
	return Boolean(removing);
}

function setRemoveOpen(nextOpen: boolean): void {
	if (!nextOpen) removing = null;
}
</script>

{#if methods.length > 0}
	<SettingsSection title="Payment methods">
		<div class="flex flex-col gap-y-0.5">
			{#each methods as method (method.id)}
				{#snippet menu()}
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({
								props,
							})}
								<button
									{...props}
									type="button"
									aria-label={`${formatPaymentMethod(method)} actions`}
									class={chipVariants()}
								>
									<Ellipsis class="size-3.5 shrink-0 text-(--text-icon)" />
								</button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								destructive
								onSelect={() => {
									removing = method;
								}}
							>
								<Trash />
								<span class={MENU_LABEL_CLASS}>Remove</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				{/snippet}
				<SettingsResourceRow
					icon={CreditCard}
					title={formatPaymentMethod(method)}
					description={formatCardExpiry(method)}
					trailing={canManage ? menu : undefined}
				/>
			{/each}
		</div>
	</SettingsSection>
{/if}
<ChipModalConfirm
	bind:open={isRemoveOpen, setRemoveOpen}
	title="Remove card"
	text={removing
		? [
				{ text: formatPaymentMethod(removing), bold: true },
				' can no longer be charged. ',
				{
					text: 'Automatic top-ups that use it stop.',
					error: true,
				},
			]
		: ''}
	pending={remove.isPending}
	onsubmit={confirmRemove}
>
	{#snippet confirm()}
		<ChipModalAction
			type="submit"
			variant="destructive"
			disabled={remove.isPending}
		>
			{remove.isPending ? 'Removing...' : 'Remove'}
		</ChipModalAction>
	{/snippet}
</ChipModalConfirm>
