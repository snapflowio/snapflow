/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateCustomDomainDto,
	type CustomDomainDto,
	CustomDomainState,
	createCustomDomain,
	deleteCustomDomain,
	ExposureDesiredState,
	type ExposureDto,
	ExposureKind,
	ensurePreviewExposure,
	listCustomDomains,
	listSandboxExposures,
} from '@snapflow/api-client';
import { listSandboxExposuresQueryKey } from '@snapflow/api-client/svelte-query';
import { mutationOptions, queryOptions } from '@tanstack/svelte-query';
import { idempotencyHeaders } from '#lib/api/client/api-client.ts';
import { collectCursorPages } from '#lib/api/client/cursor-pagination.ts';

const VERIFYING_REFRESH_MILLISECONDS = 10_000;
const VERIFYING_STATES: ReadonlySet<CustomDomainDto['state']> = new Set([
	CustomDomainState.Pending,
	CustomDomainState.Validating,
	CustomDomainState.Deleting,
]);

type ExposurePort = { port: ExposureDto['targetPort'] };

export type SandboxCustomDomain = CustomDomainDto & ExposurePort;

export type AddCustomDomain = CreateCustomDomainDto & ExposurePort;

const CUSTOM_DOMAINS_KEY = 'custom-domains';

function sandboxCustomDomainsKey(sandboxId: string) {
	return [
		...listSandboxExposuresQueryKey({ path: { sandboxId } }),
		CUSTOM_DOMAINS_KEY,
	] as const;
}

export function sandboxCustomDomainsQueryOptions(sandboxId: string) {
	return queryOptions({
		queryKey: sandboxCustomDomainsKey(sandboxId),
		queryFn: async ({ signal }): Promise<SandboxCustomDomain[]> => {
			const { data: exposures } = await listSandboxExposures({
				path: { sandboxId },
				signal,
			});
			const webExposures = exposures.filter(
				(exposure) =>
					exposure.kind === ExposureKind.Http &&
					exposure.desiredState === ExposureDesiredState.Active
			);
			const domains = await Promise.all(
				webExposures.map(async (exposure) =>
					(
						await collectCursorPages(
							async (cursor) =>
								(
									await listCustomDomains({
										path: { sandboxId, exposureId: exposure.id },
										query: { cursor },
										signal,
									})
								).data
						)
					).map((domain) => ({ ...domain, port: exposure.targetPort }))
				)
			);
			return domains.flat();
		},
		refetchInterval: (query) =>
			query.state.data?.some(({ state }) => VERIFYING_STATES.has(state))
				? VERIFYING_REFRESH_MILLISECONDS
				: false,
	});
}

export function addCustomDomainMutationOptions(sandboxId: string) {
	return mutationOptions({
		mutationFn: async ({ port, hostname }: AddCustomDomain) => {
			const { data: exposure } = await ensurePreviewExposure({
				path: { sandboxId, port },
			});
			return (
				await createCustomDomain({
					path: { sandboxId, exposureId: exposure.id },
					body: { hostname },
					headers: idempotencyHeaders(),
				})
			).data;
		},
		meta: {
			invalidates: [sandboxCustomDomainsKey(sandboxId)],
			success: 'Domain added; add the DNS records to verify it',
			failure: 'Failed to add the domain',
		},
	});
}

export function removeCustomDomainMutationOptions(sandboxId: string) {
	return mutationOptions({
		mutationFn: async (domain: Pick<CustomDomainDto, 'id' | 'exposureId'>) => {
			await deleteCustomDomain({
				path: {
					sandboxId,
					exposureId: domain.exposureId,
					domainId: domain.id,
				},
			});
		},
		meta: {
			invalidates: [sandboxCustomDomainsKey(sandboxId)],
			success: 'Domain removal started',
			failure: 'Failed to remove the domain',
		},
	});
}
