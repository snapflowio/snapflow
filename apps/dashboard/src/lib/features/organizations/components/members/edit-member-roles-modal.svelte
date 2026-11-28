<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { OrganizationBaseRole } from '@snapflow/organization-access';
import type { MemberRoles } from '#lib/api/organizations/member-roles.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import MemberRoleFields from './member-role-fields.svelte';

interface EditMemberRolesModalProps {
	open?: boolean;
	email: string;
	initialRoles: MemberRoles;
	pending: boolean;
	onSave: (roles: MemberRoles) => void;
}

let {
	open = $bindable(false),
	email,
	initialRoles,
	pending,
	onSave,
}: EditMemberRolesModalProps = $props();

let baseRole = $derived<OrganizationBaseRole>(initialRoles.baseRole);
let additionalRoles = $derived<string[]>(initialRoles.additionalRoles);

function close(): void {
	if (!pending) open = false;
}

function submit(): void {
	if (pending) return;
	onSave({ baseRole, additionalRoles });
}
</script>

<ChipModal
	bind:open
	onsubmit={submit}
	dismissDisabled={pending}
	srTitle={`Edit roles for ${email}`}
>
	<ChipModalHeader onClose={close} closeDisabled={pending}>
		Edit roles
	</ChipModalHeader>
	<ChipModalBody>
		<p class="text-(--text-primary) text-sm">
			Roles for <strong class="font-medium">{email}</strong>
		</p>
		<MemberRoleFields bind:baseRole bind:additionalRoles disabled={pending} />
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={pending}>
		{#snippet primaryAction()}
			<Chip
				loading={pending}
				type="submit"
				variant="primary"
				disabled={pending}
			>
				Save
			</Chip>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
