<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { AuthError } from '#lib/api/auth/auth-error-codes.ts';
import { hasErrorCode } from '#lib/api/errors/api-error-details.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;
const INVALID_INVITATION_STATUSES: ReadonlySet<unknown> = new Set([
	BAD_REQUEST_STATUS,
	NOT_FOUND_STATUS,
]);
const INVALID_INVITATION_TITLE = 'Invitation not found';
const INVALID_INVITATION_MESSAGE = 'It may have expired or been revoked.';
const LOAD_FAILED_TITLE = "Couldn't load the invitation";

type InvitationErrorKind = 'wrong-account' | 'invalid' | 'other';

function invitationErrorKind(error: unknown): InvitationErrorKind {
	if (
		hasErrorCode(
			error,
			AuthError.YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION.code
		)
	) {
		return 'wrong-account';
	}
	const invitationError = SnapflowError.fromUnknown(error);
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
import { userErrorMessage } from '#lib/api/errors/api-error-details.ts';
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
		switchError = userErrorMessage(signOutError);
	} finally {
		switchingAccount = false;
	}
}
</script>

{#snippet responseError()}
	{#if respond.isError}
		<AuthFormMessage type="error" align="center">
			{userErrorMessage(respond.error)}
		</AuthFormMessage>
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
		description="This invitation was sent to a different email address."
		details={switchAccountError}
		actions={[
			{
				label: 'Sign in with a different account',
				loading: switchingAccount,
				onSelect: () => void signInWithDifferentAccount(),
			},
			goToDashboard,
		]}
	/>
{:else if invitation.isError}
	<AuthStatusCard
		title={errorKind === 'invalid'
			? INVALID_INVITATION_TITLE
			: LOAD_FAILED_TITLE}
		description={errorKind === 'invalid'
			? INVALID_INVITATION_MESSAGE
			: userErrorMessage(invitation.error)}
		actions={errorKind === 'invalid'
			? [goToDashboard]
			: [
					{
						label: 'Try again',
						loading: invitation.isFetching,
						onSelect: () => void invitation.refetch(),
					},
					goToDashboard,
				]}
	/>
{:else if !details}
	<AuthStatusCard loading title="Organization invitation" />
{:else if answered === INVITATION_RESPONSE.ACCEPT}
	<AuthStatusCard
		title={`You joined ${details.organizationName}`}
		description="It's now your active organization."
		actions={[goToDashboard]}
	/>
{:else if answered === INVITATION_RESPONSE.REJECT}
	<AuthStatusCard
		title="Invitation declined"
		description={`You didn't join ${details.organizationName}.`}
		actions={[goToDashboard]}
	/>
{:else}
	<AuthStatusCard
		title={`Join ${details.organizationName}`}
		description={`${details.inviterEmail} invited you as ${formatOrganizationRoles(parseOrganizationRoles(details.role))}. Expires ${formatDateTime(details.expiresAt)}.`}
		details={responseError}
		actions={[
			{
				label: 'Accept invitation',
				loading:
					respond.isPending &&
					respond.variables?.response === INVITATION_RESPONSE.ACCEPT,
				disabled: respond.isPending,
				onSelect: () => answer(INVITATION_RESPONSE.ACCEPT),
			},
			{
				label: 'Decline',
				loading:
					respond.isPending &&
					respond.variables?.response === INVITATION_RESPONSE.REJECT,
				disabled: respond.isPending,
				onSelect: () => answer(INVITATION_RESPONSE.REJECT),
			},
		]}
	/>
{/if}
