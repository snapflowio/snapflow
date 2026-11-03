/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type AdminGrantCredit,
	type AdminListOrganizationsData,
	type AdminOrganization,
	adminCreateOrganizationQuota,
	adminDeleteOrganizationQuota,
	adminGrantOrganizationCredit,
	adminSuspendOrganization,
	adminUnsuspendOrganization,
	adminUpdateOrganizationLimits,
	adminUpdateOrganizationQuota,
	type CreateOrganizationQuota,
	type OrganizationSuspension,
	SandboxClass,
	type UpdateOrganizationLimits,
} from '@snapflow/api-client';
import {
	adminGetOrganizationLimitsOptions,
	adminGetOrganizationLimitsQueryKey,
	adminGetOrganizationOptions,
	adminGetOrganizationQueryKey,
	adminListOrganizationQuotasOptions,
	adminListOrganizationQuotasQueryKey,
	adminListOrganizationsInfiniteOptions,
	adminListOrganizationsQueryKey,
} from '@snapflow/api-client/svelte-query';
import { mutationOptions } from '@tanstack/svelte-query';
import { idempotencyHeaders } from '#lib/api/client/api-client.ts';

export const QUOTA_SANDBOX_CLASS = SandboxClass.LinuxVm;

export type OrganizationQuotaValues = Omit<
	CreateOrganizationQuota,
	'allowedGpuTypes' | 'sandboxClass'
>;

export interface AdminOrganizationSuspension {
	organization: AdminOrganization;
	suspension: OrganizationSuspension;
}

interface OrganizationQuotaSave {
	exists: boolean;
	values: OrganizationQuotaValues;
}

const listInvalidates = [adminListOrganizationsQueryKey()];

function quotasQueryKey(organizationId: string) {
	return adminListOrganizationQuotasQueryKey({
		path: { organizationId },
	});
}

export function adminOrganizationsInfiniteQueryOptions(
	query: AdminListOrganizationsData['query']
) {
	return adminListOrganizationsInfiniteOptions({ query });
}

export function adminOrganizationQueryOptions(organizationId: string) {
	return adminGetOrganizationOptions({ path: { organizationId } });
}

export function adminOrganizationQuotasQueryOptions(organizationId: string) {
	return adminListOrganizationQuotasOptions({ path: { organizationId } });
}

export function adminOrganizationLimitsQueryOptions(organizationId: string) {
	return adminGetOrganizationLimitsOptions({ path: { organizationId } });
}

export function suspendOrganizationMutationOptions() {
	return mutationOptions({
		mutationFn: ({ organization, suspension }: AdminOrganizationSuspension) =>
			adminSuspendOrganization({
				path: { organizationId: organization.id },
				body: suspension,
			}),
		meta: {
			success: 'Organization suspended',
			failure: 'Failed to suspend organization',
			invalidates: listInvalidates,
		},
	});
}

export function unsuspendOrganizationMutationOptions() {
	return mutationOptions({
		mutationFn: (organization: AdminOrganization) =>
			adminUnsuspendOrganization({
				path: { organizationId: organization.id },
			}),
		meta: {
			success: 'Organization unsuspended',
			failure: 'Failed to unsuspend organization',
			invalidates: listInvalidates,
		},
	});
}

export function updateOrganizationLimitsMutationOptions(
	organizationId: string
) {
	return mutationOptions({
		mutationFn: (limits: UpdateOrganizationLimits) =>
			adminUpdateOrganizationLimits({
				path: { organizationId },
				body: limits,
			}),
		meta: {
			success: 'Organization limits updated',
			failure: 'Failed to update organization limits',
			invalidates: [
				adminGetOrganizationLimitsQueryKey({ path: { organizationId } }),
			],
		},
	});
}

export function saveOrganizationQuotaMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async ({ exists, values }: OrganizationQuotaSave) => {
			const quota = { sandboxClass: QUOTA_SANDBOX_CLASS, ...values };
			const path = { organizationId };
			await (exists
				? adminUpdateOrganizationQuota({ path, body: quota })
				: adminCreateOrganizationQuota({ path, body: quota }));
		},
		meta: {
			success: 'Quota saved',
			failure: 'Failed to save quota',
			invalidates: [quotasQueryKey(organizationId)],
		},
	});
}

export function removeOrganizationQuotaMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: () =>
			adminDeleteOrganizationQuota({
				path: { organizationId, sandboxClass: QUOTA_SANDBOX_CLASS },
			}),
		meta: {
			success: 'Quota removed',
			failure: 'Failed to remove quota',
			invalidates: [quotasQueryKey(organizationId)],
		},
	});
}

export function grantOrganizationCreditMutationOptions(organizationId: string) {
	return mutationOptions({
		mutationFn: async (grant: AdminGrantCredit) =>
			(
				await adminGrantOrganizationCredit({
					path: { organizationId },
					body: grant,
					headers: idempotencyHeaders(),
				})
			).data,
		meta: {
			success: 'Credit granted',
			failure: 'Failed to grant credit',
			invalidates: [
				adminListOrganizationsQueryKey(),
				adminGetOrganizationQueryKey({ path: { organizationId } }),
			],
		},
	});
}
