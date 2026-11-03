<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import {
	DEFAULT_INVITATION_ROLE,
	type OrganizationBaseRole,
} from '@snapflow/organization-access';
import {
	type MemberRoles,
	splitMemberRoles,
} from '#lib/api/organizations/member-roles.ts';

const DEFAULT_ROLES = splitMemberRoles(DEFAULT_INVITATION_ROLE);
const MAX_LISTED_FAILURE_REASONS = 3;

interface InviteFailure {
	email: string;
	error: string;
}

function inviteFailureMessage(
	failures: readonly InviteFailure[],
	attempted: number
): string {
	if (failures.length === 1) return failures[0]?.error ?? '';
	const headline =
		failures.length >= attempted
			? `None of the ${failures.length} invitations could be sent.`
			: `${failures.length} of ${attempted} invitations could not be sent.`;
	const reasons = [...new Set(failures.map((failure) => failure.error))];
	const listed = reasons.slice(0, MAX_LISTED_FAILURE_REASONS);
	const remaining = reasons.length - listed.length;
	return [headline, ...listed, remaining > 0 ? `And ${remaining} more.` : null]
		.filter(Boolean)
		.join(' ');
}

function errorMessage(error: unknown): string {
	return error instanceof Error && error.message
		? error.message
		: 'An unexpected error occurred. Please try again.';
}

interface InviteModalProps {
	open?: boolean;
	canInvite: boolean;
	onInvite: (input: { email: string; roles: MemberRoles }) => Promise<unknown>;
}
</script>

<script lang="ts">
import { watch } from 'runed';
import ChipModal from '#lib/components/ui/chip-modal/chip-modal.svelte';
import ChipModalAction from '#lib/components/ui/chip-modal/chip-modal-action.svelte';
import ChipModalBody from '#lib/components/ui/chip-modal/chip-modal-body.svelte';
import ChipModalError from '#lib/components/ui/chip-modal/chip-modal-error.svelte';
import ChipModalField from '#lib/components/ui/chip-modal/chip-modal-field.svelte';
import ChipModalFooter from '#lib/components/ui/chip-modal/chip-modal-footer.svelte';
import ChipModalHeader from '#lib/components/ui/chip-modal/chip-modal-header.svelte';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { pluralize } from '#lib/utils/text.ts';
import EmailsInput from './emails-input.svelte';
import MemberRoleFields from './member-role-fields.svelte';

let {
	open = $bindable(false),
	canInvite,
	onInvite,
}: InviteModalProps = $props();

const emailsId = $props.id();
const auth = getAuth();

let emails = $state<string[]>([]);
let baseRole = $state<OrganizationBaseRole>(DEFAULT_ROLES.baseRole);
let additionalRoles = $state<string[]>(DEFAULT_ROLES.additionalRoles);
let failure = $state<string | null>(null);
let submitting = $state(false);

watch(
	() => open,
	(isOpen) => {
		if (!isOpen) return;
		emails = [];
		baseRole = DEFAULT_ROLES.baseRole;
		additionalRoles = DEFAULT_ROLES.additionalRoles;
		failure = null;
	}
);

function close(): void {
	if (submitting) return;
	open = false;
}

function validateEmail(email: string): string | null {
	const own = auth.user?.email?.toLowerCase();
	return own && own === email ? 'You cannot invite yourself' : null;
}

async function send(): Promise<void> {
	if (submitting || emails.length === 0 || !canInvite) return;
	failure = null;
	submitting = true;
	const attempted = [...emails];
	const roles: MemberRoles = { baseRole, additionalRoles };
	const results = await Promise.all(
		attempted.map(async (email) => {
			try {
				await onInvite({ email, roles });
				return null;
			} catch (error) {
				return { email, error: errorMessage(error) };
			}
		})
	);
	submitting = false;
	const failures = results.filter((result) => result !== null);
	const sent = attempted.length - failures.length;
	if (sent > 0) toast.success(`${pluralize(sent, 'invite')} sent`);
	if (failures.length > 0) {
		emails = failures.map((result) => result.email);
		failure = inviteFailureMessage(failures, attempted.length);
		return;
	}
	open = false;
}
</script>

<ChipModal
	bind:open
	dismissDisabled={submitting}
	srTitle="Invite teammates to organization"
>
	<ChipModalHeader onClose={close} closeDisabled={submitting}>
		Invite teammates
	</ChipModalHeader>
	<ChipModalBody>
		<ChipModalField label="Emails" for={emailsId}>
			<EmailsInput
				id={emailsId}
				value={emails}
				onChange={(next) => {
					emails = next;
					failure = null;
				}}
				validate={validateEmail}
				placeholder={canInvite
					? 'Enter emails'
					: 'Only administrators can invite new teammates'}
				disabled={submitting || !canInvite}
			/>
		</ChipModalField>
		<MemberRoleFields
			bind:baseRole
			bind:additionalRoles
			disabled={submitting || !canInvite}
		/>
		<ChipModalError message={failure} />
	</ChipModalBody>
	<ChipModalFooter onCancel={close} cancelDisabled={submitting}>
		{#snippet primaryAction()}
			<ChipModalAction
				variant="primary"
				disabled={!canInvite || submitting || emails.length === 0}
				onclick={() => void send()}
			>
				{submitting ? 'Sending...' : 'Send invites'}
			</ChipModalAction>
		{/snippet}
	</ChipModalFooter>
</ChipModal>
