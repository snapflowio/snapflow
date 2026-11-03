/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	OrganizationCountQuotaType,
	OrganizationUsageQuotaType,
	OrganizationUsageResourceType,
	SandboxQuotaResource,
	SandboxUsageScope,
} from './organization-usage.util';

const USAGE_KEY_SUFFIX = {
	current: 'usage',
	pending: 'pending',
} as const;

type UsageKeyKind = keyof typeof USAGE_KEY_SUFFIX;

function scopePrefix(organizationId: string, sandboxClass?: string): string {
	return `organization:${organizationId}${sandboxClass ? `:class:${sandboxClass}` : ''}`;
}

function quotaUsageKey(
	kind: UsageKeyKind,
	quotaType: OrganizationUsageQuotaType,
	organizationId: string,
	sandboxClass?: string
): string {
	return `${scopePrefix(organizationId, sandboxClass)}:quota:${quotaType}:${USAGE_KEY_SUFFIX[kind]}`;
}

export function sandboxUsageKey(
	kind: UsageKeyKind,
	scope: SandboxUsageScope,
	resource: SandboxQuotaResource
): string {
	return quotaUsageKey(
		kind,
		resource,
		scope.organizationId,
		scope.sandboxClass
	);
}

export function countUsageKey(
	kind: UsageKeyKind,
	organizationId: string,
	quotaType: OrganizationCountQuotaType
): string {
	return quotaUsageKey(kind, quotaType, organizationId);
}

export function usageFetchedAtKey(
	organizationId: string,
	resourceType: OrganizationUsageResourceType,
	scope?: SandboxUsageScope
): string {
	return `${scopePrefix(organizationId, scope?.sandboxClass)}:resource:${resourceType}:usage:fetched_at`;
}

export function parseNonNegativeCachedValue(
	value: string | null
): number | null {
	if (value === null) {
		return null;
	}

	const parsedValue = Number(value);

	if (Number.isNaN(parsedValue) || parsedValue < 0) {
		return null;
	}

	return parsedValue;
}

export function calculateQuotaUsageDelta<TState>(
	resourceAmount: number,
	oldState: TState,
	newState: TState,
	statesConsumingResource: TState[]
): number {
	const wasConsumingResource = statesConsumingResource.includes(oldState);
	const isConsumingResource = statesConsumingResource.includes(newState);

	if (!wasConsumingResource && isConsumingResource) {
		return resourceAmount;
	}

	if (wasConsumingResource && !isConsumingResource) {
		return -resourceAmount;
	}

	return 0;
}
