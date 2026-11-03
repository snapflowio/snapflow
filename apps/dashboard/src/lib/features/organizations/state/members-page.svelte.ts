/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Plus from '@lucide/svelte/icons/plus';
import {
	ORGANIZATION_BASE_ROLES,
	ORGANIZATION_CUSTOM_ROLE_LIMIT,
	ORGANIZATION_ROLE,
	type OrganizationBaseRole,
} from '@snapflow/organization-access';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	cancelInvitationMutationOptions,
	inviteMemberMutationOptions,
	type OrganizationInvitation,
	organizationInvitationsQueryOptions,
} from '#lib/api/organizations/invitations.ts';
import type { MemberRoles } from '#lib/api/organizations/member-roles.ts';
import {
	leaveOrganizationMutationOptions,
	membersQueryOptions,
	type OrganizationMember,
	removeMemberMutationOptions,
	updateMemberRolesMutationOptions,
} from '#lib/api/organizations/members.ts';
import {
	type CustomRoleInput,
	createRoleMutationOptions,
	deleteRoleMutationOptions,
	type OrganizationCustomRole,
	organizationRolesQueryOptions,
	updateRoleMutationOptions,
} from '#lib/api/organizations/roles.ts';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import {
	matchesInvitation,
	matchesMember,
	membersSearchSchema,
} from '#lib/features/organizations/lib/members-page.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { Path } from '#lib/routing/paths.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { organizationRoleLabel } from '#lib/utils/organization-roles.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

interface RoleEditor {
	role: OrganizationCustomRole | null;
}

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
	readonly #createRole = createMutation(() =>
		createRoleMutationOptions(this.#organizationId)
	);
	readonly #updateRole = createMutation(() =>
		updateRoleMutationOptions(this.#organizationId)
	);

	readonly search = new SearchParams(membersSearchSchema).text('search');
	readonly membersQuery = createQuery(() =>
		membersQueryOptions(this.#organizationId)
	);
	readonly invitationsQuery = createQuery(() =>
		organizationInvitationsQueryOptions(this.#organizationId)
	);
	readonly rolesQuery = createQuery(() => ({
		...organizationRolesQueryOptions(this.#organizationId),
		enabled: this.#auth.activeOrganizationId !== null,
	}));
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
	readonly deleteRoleMutation = createMutation(() =>
		deleteRoleMutationOptions(this.#organizationId)
	);

	inviteOpen = $state(false);
	editing = $state.raw<OrganizationMember | null>(null);
	removing = $state.raw<OrganizationMember | null>(null);
	leaving = $state(false);
	revoking = $state.raw<OrganizationInvitation | null>(null);
	roleEditor = $state.raw<RoleEditor | null>(null);
	deletingRole = $state.raw<OrganizationCustomRole | null>(null);

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
	readonly canInvite = $derived(
		this.#permission.can({ invitation: ['create'] }) && !this.personal
	);
	readonly canCancel = $derived(
		this.#permission.can({ invitation: ['cancel'] })
	);
	readonly canUpdateRole = $derived(this.#permission.can({ ac: ['update'] }));
	readonly canDeleteRole = $derived(this.#permission.can({ ac: ['delete'] }));
	readonly customRoles = $derived(this.rolesQuery.data ?? []);
	readonly query = $derived(this.search.value.trim());
	readonly #normalizedQuery = $derived(this.query.toLowerCase());
	readonly searching = $derived(this.#normalizedQuery.length > 0);
	readonly #members = $derived(this.membersQuery.data ?? []);
	readonly #invitations = $derived(this.invitationsQuery.data ?? []);
	readonly visibleMembers = $derived(
		this.#members.filter((member) =>
			matchesMember(member, this.#normalizedQuery)
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
	readonly memberCount = $derived(
		this.#members.length + this.#invitations.length
	);
	readonly baseRoleOptions = $derived(
		ORGANIZATION_BASE_ROLES.filter(
			(role) => this.#permission.isOwner || role !== ORGANIZATION_ROLE.OWNER
		).map((role) => ({ label: organizationRoleLabel(role), value: role }))
	);
	readonly headerActions = $derived.by((): HeaderAction[] => {
		const roleLimitReached =
			this.customRoles.length >= ORGANIZATION_CUSTOM_ROLE_LIMIT;
		return [
			{
				id: 'new-role',
				label: 'New role',
				visible: this.#permission.can({ ac: ['create'] }),
				disabled: roleLimitReached,
				disabledReason: roleLimitReached
					? `Organizations can have up to ${ORGANIZATION_CUSTOM_ROLE_LIMIT} custom roles`
					: undefined,
				onSelect: () => (this.roleEditor = { role: null }),
			},
			{
				id: 'invite',
				kind: 'primary',
				label: 'Invite',
				icon: Plus,
				visible: this.#permission.can({ invitation: ['create'] }),
				disabled: !this.canInvite,
				disabledReason: this.personal
					? 'Personal organizations cannot be shared'
					: undefined,
				onSelect: () => (this.inviteOpen = true),
			},
		];
	});

	editableMember = (roles: MemberRoles): boolean =>
		this.canUpdate &&
		(this.#permission.isOwner || roles.baseRole !== ORGANIZATION_ROLE.OWNER);

	copyEmail = (email: string): void => {
		void navigator.clipboard.writeText(email);
	};

	changeBaseRole = (
		member: OrganizationMember,
		roles: MemberRoles,
		baseRole: OrganizationBaseRole
	): void => {
		if (baseRole === roles.baseRole) return;
		this.updateRolesMutation.mutate({
			member,
			roles: { baseRole, additionalRoles: roles.additionalRoles },
		});
	};

	closeEdit = (open: boolean): void => {
		if (!open) this.editing = null;
	};

	closeRoleEditor = (open: boolean): void => {
		if (!open) this.roleEditor = null;
	};

	invite = (input: MemberInvite): Promise<unknown> =>
		this.#invite.mutateAsync(input);

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

	saveRole = async (input: CustomRoleInput): Promise<void> => {
		const role = this.roleEditor?.role;
		if (role) await this.#updateRole.mutateAsync({ ...input, role });
		else await this.#createRole.mutateAsync(input);
		this.roleEditor = null;
	};

	removeRole = (role: OrganizationCustomRole): void => {
		this.deleteRoleMutation.mutate(role, {
			onSuccess: () => {
				this.deletingRole = null;
			},
		});
	};
}
