/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Plus from '@lucide/svelte/icons/plus';
import { ORGANIZATION_ROLE } from '@snapflow/organization-access';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	cancelInvitationMutationOptions,
	inviteMemberMutationOptions,
	type OrganizationInvitation,
	organizationInvitationsQueryOptions,
	resendInvitationMutationOptions,
} from '#lib/api/organizations/invitations.ts';
import type { MemberRoles } from '#lib/api/organizations/member-roles.ts';
import {
	leaveOrganizationMutationOptions,
	membersQueryOptions,
	type OrganizationMember,
	removeMemberMutationOptions,
	updateMemberRolesMutationOptions,
} from '#lib/api/organizations/members.ts';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import {
	activeSort,
	resourceListSortConfig,
	sortRows,
} from '#lib/components/resource/resource-list.ts';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { ResourceSortState } from '#lib/components/resource/table/resource-table-sort.ts';
import { copyWithToast } from '#lib/components/ui/clipboard/copy-with-toast.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import {
	MEMBER_SORT_ACCESSORS,
	MEMBER_SORT_OPTIONS,
	matchesInvitation,
	matchesMember,
	membersSearchSchema,
} from '#lib/features/organizations/lib/members-page.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path, resolvePath } from '#lib/routing/paths.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

const PERSONAL_REASON = "Personal organizations can't be shared";
const NO_INVITE_PERMISSION_REASON = 'Needs the Admin or Owner role';

interface MemberInvite {
	email: string;
	roles: MemberRoles;
}

export class MembersPage {
	readonly #auth = getAuth();
	readonly #permission = getOrganizationPermission();
	readonly #organizationId = $derived(this.#auth.activeOrganizationId ?? '');
	readonly #invite = createMutation(() => {
		const options = inviteMemberMutationOptions(this.#organizationId);
		return {
			...options,
			meta: { ...options.meta, success: undefined, failure: undefined },
		};
	});

	readonly search = new SearchParams(membersSearchSchema).text('search');
	readonly membersQuery = createQuery(() =>
		membersQueryOptions(this.#organizationId)
	);
	readonly invitationsQuery = createQuery(() =>
		organizationInvitationsQueryOptions(this.#organizationId)
	);
	readonly updateRolesMutation = createMutation(() =>
		updateMemberRolesMutationOptions(this.#organizationId)
	);
	readonly removeMutation = createMutation(() =>
		removeMemberMutationOptions(this.#organizationId)
	);
	readonly leaveMutation = createMutation(() =>
		leaveOrganizationMutationOptions(this.#organizationId)
	);
	readonly cancelMutation = createMutation(() =>
		cancelInvitationMutationOptions(this.#organizationId)
	);
	readonly resendMutation = createMutation(() =>
		resendInvitationMutationOptions(this.#organizationId)
	);

	inviteOpen = $state(false);
	editing = $state.raw<OrganizationMember | null>(null);
	removing = $state.raw<OrganizationMember | null>(null);
	leaving = $state(false);
	revoking = $state.raw<OrganizationInvitation | null>(null);

	readonly currentUserId = $derived(this.#auth.user?.id);
	readonly organizationName = $derived(this.#auth.activeOrganization?.name);
	readonly personal = $derived(
		this.#auth.activeOrganization?.personal === true
	);
	readonly canUpdate = $derived(
		this.#permission.can({ member: ['update'] }) && !this.personal
	);
	readonly canRemove = $derived(
		this.#permission.can({ member: ['delete'] }) && !this.personal
	);
	readonly #canCreateInvitation = $derived(
		this.#permission.can({ invitation: ['create'] })
	);
	readonly canInvite = $derived(this.#canCreateInvitation && !this.personal);
	readonly canCancel = $derived(
		this.#permission.can({ invitation: ['cancel'] })
	);
	readonly canViewAudit = $derived(
		this.#permission.can({ audit_logs: ['read'] })
	);
	readonly query = $derived(this.search.value.trim());
	readonly #normalizedQuery = $derived(this.query.toLowerCase());
	readonly searching = $derived(this.#normalizedQuery.length > 0);
	readonly #members = $derived(this.membersQuery.data ?? []);
	readonly #invitations = $derived(this.invitationsQuery.data ?? []);
	#sort = $state.raw<ResourceSortState | null>(null);
	readonly sortConfig: ResourceSortConfig = $derived(
		resourceListSortConfig(
			MEMBER_SORT_OPTIONS,
			this.#sort,
			(column, direction) => {
				this.#sort = activeSort(column, direction);
			}
		)
	);
	readonly visibleMembers = $derived(
		sortRows(
			this.#members.filter((member) =>
				matchesMember(member, this.#normalizedQuery)
			),
			this.#sort,
			MEMBER_SORT_ACCESSORS
		)
	);
	readonly visibleInvitations = $derived(
		this.#invitations.filter((invitation) =>
			matchesInvitation(invitation, this.#normalizedQuery)
		)
	);
	readonly visibleCount = $derived(
		this.visibleMembers.length + this.visibleInvitations.length
	);
	readonly #inviteDisabledReason = $derived.by(() => {
		if (this.personal) return PERSONAL_REASON;
		if (!this.#canCreateInvitation) return NO_INVITE_PERMISSION_REASON;
		return undefined;
	});
	readonly headerActions = $derived.by((): HeaderAction[] => [
		{
			id: 'roles',
			label: 'Roles',
			href: resolvePath(Path.MEMBER_ROLES),
		},
		{
			id: 'invite',
			kind: 'primary',
			label: 'Invite',
			icon: Plus,
			disabled: !this.canInvite,
			disabledReason: this.#inviteDisabledReason,
			onSelect: () => (this.inviteOpen = true),
		},
	]);

	editableMember = (roles: MemberRoles): boolean =>
		this.canUpdate &&
		(this.#permission.isOwner || roles.baseRole !== ORGANIZATION_ROLE.OWNER);

	copyEmail = (email: string): void => {
		void copyWithToast(email, 'email address');
	};

	closeEdit = (open: boolean): void => {
		if (!open) this.editing = null;
	};

	invite = (input: MemberInvite): Promise<unknown> =>
		this.#invite.mutateAsync(input);

	resendInvitation = (invitation: OrganizationInvitation): void => {
		this.resendMutation.mutate(invitation);
	};

	saveRoles = (roles: MemberRoles): void => {
		if (!this.editing) return;
		this.updateRolesMutation.mutate(
			{ member: this.editing, roles },
			{
				onSuccess: () => {
					this.editing = null;
				},
			}
		);
	};

	removeMember = (member: OrganizationMember): void => {
		this.removeMutation.mutate(member, {
			onSuccess: () => {
				this.removing = null;
			},
		});
	};

	leaveOrganization = (): void => {
		this.leaveMutation.mutate(undefined, {
			onSuccess: async () => {
				await this.#auth.refetchOrganizations();
				this.leaving = false;
				toast.success('You left the organization');
				await goto(resolve(Path.DASHBOARD));
			},
		});
	};

	revokeInvitation = (invitation: OrganizationInvitation): void => {
		this.cancelMutation.mutate(invitation, {
			onSuccess: () => {
				this.revoking = null;
			},
		});
	};
}
