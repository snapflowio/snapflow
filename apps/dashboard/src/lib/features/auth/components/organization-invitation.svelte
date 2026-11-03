<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const WRONG_RECIPIENT_CODE = 'YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION';
const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;
const INVALID_INVITATION_STATUSES: ReadonlySet<unknown> = new Set([
	BAD_REQUEST_STATUS,
	NOT_FOUND_STATUS,
]);
const INVALID_INVITATION_MESSAGE =
	'This invitation is invalid or no longer exists.';

type InvitationErrorKind = 'wrong-account' | 'invalid' | 'other';

function invitationErrorKind(error: unknown): InvitationErrorKind {
	const invitationError = SnapflowError.fromUnknown(error);
	if (invitationError.code === WRONG_RECIPIENT_CODE) return 'wrong-account';
	const details = invitationError.details;
	const status =
		details && typeof details === 'object'
			? Reflect.get(details, 'status')
			: null;
	return INVALID_INVITATION_STATUSES.has(status) ? 'invalid' : 'other';
}

interface OrganizationInvitationProps {
	invitationId: string;
}
</script>

<script lang="ts">
import { parseOrganizationRoles } from '@snapflow/organization-access';
import {
	createMutation,
	createQuery,
	useQueryClient,
} from '@tanstack/svelte-query';
import { signOut } from '#lib/api/auth/session.ts';
import {
	INVITATION_RESPONSE,
	type InvitationResponse,
	invitationQueryOptions,
	invitationResponseMutationOptions,
} from '#lib/api/organizations/invitations.ts';
import AuthFormMessage from '#lib/features/auth/components/layout/auth-form-message.svelte';
import AuthStatusCard, {
	type AuthStatusAction,
} from '#lib/features/auth/components/layout/auth-status-card.svelte';
import { authErrorMessage } from '#lib/features/auth/lib/auth-error-message.ts';
import { loginHref } from '#lib/features/auth/lib/auth-return-to.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { formatDateTime } from '#lib/utils/format.ts';
import { formatOrganizationRoles } from '#lib/utils/organization-roles.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';

let { invitationId }: OrganizationInvitationProps = $props();

const auth = getAuth();
const queryClient = useQueryClient();
const invitation = createQuery(() => invitationQueryOptions(invitationId));
const respond = createMutation(() => invitationResponseMutationOptions());
const details = $derived(invitation.data);
const answered = $derived(respond.data);
const errorKind = $derived(
	invitation.isError ? invitationErrorKind(invitation.error) : null
);
const goToDashboard: AuthStatusAction = {
	label: 'Go to dashboard',
	href: resolve(Path.DASHBOARD),
};

let switchingAccount = $state(false);
let switchError = $state<string | null>(null);

function answer(response: InvitationResponse): void {
	respond.mutate(
		{ invitationId, response },
		{
			onSuccess: () => {
				if (response === INVITATION_RESPONSE.ACCEPT)
					void auth.refetchOrganizations();
			},
		}
	);
}

async function signInWithDifferentAccount(): Promise<void> {
	const returnTo = loginHref(page.url);
	switchError = null;
	switchingAccount = true;
	try {
		await signOut(queryClient);
		await goto(returnTo);
	} catch (signOutError) {
		switchError = authErrorMessage(signOutError);
	} finally {
		switchingAccount = false;
	}
}
</script>

{#snippet disclosure()}
	{#if details}
		<div class="space-y-3 text-left text-(--text-body) text-small">
			<p>
				You will join
				<strong class="font-medium">{details.organizationName}</strong>
				as
				<strong class="font-medium">
					{formatOrganizationRoles(parseOrganizationRoles(details.role))}
				</strong
				>. The invitation expires {formatDateTime(details.expiresAt)}.
			</p>
			{#if respond.isError}
				<AuthFormMessage type="error">
					{authErrorMessage(respond.error)}
				</AuthFormMessage>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet switchAccountError()}
	{#if switchError}
		<AuthFormMessage type="error" align="center">{switchError}</AuthFormMessage>
	{/if}
{/snippet}

{#if errorKind === 'wrong-account'}
	<AuthStatusCard
		title="Wrong account"
		description="This invitation was sent to a different email address. Please sign in with the correct account."
		details={switchAccountError}
		actions={[
			{
				label: 'Sign in with a different account',
				loadingLabel: 'Signing out...',
				loading: switchingAccount,
				disabled: switchingAccount,
				onSelect: () => void signInWithDifferentAccount(),
			},
			goToDashboard,
		]}
	/>
{:else if invitation.isError}
	<AuthStatusCard
		title="Invitation error"
		description={errorKind === 'invalid'
			? INVALID_INVITATION_MESSAGE
			: authErrorMessage(invitation.error)}
		actions={errorKind === 'invalid'
			? [goToDashboard]
			: [
					{
						label: 'Try again',
						loading: invitation.isFetching,
						disabled: invitation.isFetching,
						onSelect: () => void invitation.refetch(),
					},
					goToDashboard,
				]}
	/>
{:else if !details}
	<AuthStatusCard
		loading
		title="Organization invitation"
		description="Loading invitation..."
	/>
{:else if answered === INVITATION_RESPONSE.ACCEPT}
	<AuthStatusCard
		title="Welcome!"
		description={`You have successfully joined ${details.organizationName}. It is now your active organization.`}
		actions={[goToDashboard]}
	/>
{:else if answered === INVITATION_RESPONSE.REJECT}
	<AuthStatusCard
		title="Invitation declined"
		description={`You did not join ${details.organizationName}.`}
		actions={[goToDashboard]}
	/>
{:else}
	<AuthStatusCard
		title="Organization invitation"
		description={`${details.inviterEmail} invited you to join ${details.organizationName}.`}
		details={disclosure}
		actions={[
			{
				label: 'Accept invitation',
				loadingLabel: 'Joining...',
				loading:
					respond.isPending &&
					respond.variables?.response === INVITATION_RESPONSE.ACCEPT,
				disabled: respond.isPending,
				onSelect: () => answer(INVITATION_RESPONSE.ACCEPT),
			},
			{
				label: 'Decline',
				loadingLabel: 'Declining...',
				loading:
					respond.isPending &&
					respond.variables?.response === INVITATION_RESPONSE.REJECT,
				disabled: respond.isPending,
				onSelect: () => answer(INVITATION_RESPONSE.REJECT),
			},
		]}
	/>
{/if}
