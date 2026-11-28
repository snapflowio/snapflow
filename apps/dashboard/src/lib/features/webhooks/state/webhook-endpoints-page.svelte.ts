/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Plus from '@lucide/svelte/icons/plus';
import { createQuery } from '@tanstack/svelte-query';
import { watch } from 'runed';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import { allWebhookEndpointsQueryOptions } from '#lib/api/webhooks.ts';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import {
	matchesEndpoint,
	webhookEndpointsSearchSchema,
} from '#lib/features/webhooks/lib/webhook-display.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { WebhookEndpointActions } from './webhook-endpoint-actions.svelte.ts';

const NO_WRITE_REASON = "Your role can't manage webhooks";

export class WebhookEndpointsPage {
	readonly docsHref = getWebsiteLinks().docsHref;
	readonly #params = new SearchParams(webhookEndpointsSearchSchema);
	readonly search = this.#params.text('search');
	readonly endpointsQuery = createQuery(() =>
		allWebhookEndpointsQueryOptions()
	);
	readonly actions = new WebhookEndpointActions(
		() => undefined,
		() => undefined
	);

	readonly query = $derived(this.search.value.trim());
	readonly allEndpoints = $derived(this.endpointsQuery.data ?? []);
	readonly endpoints = $derived(
		this.allEndpoints.filter((endpoint) =>
			matchesEndpoint(endpoint, this.query.toLowerCase())
		)
	);
	readonly createDisabledReason = $derived(
		this.actions.canWrite ? undefined : NO_WRITE_REASON
	);
	readonly headerActions = $derived.by((): HeaderAction[] => [
		{
			id: 'create',
			kind: 'primary',
			label: 'Add endpoint',
			icon: Plus,
			disabled: !this.actions.canWrite,
			disabledReason: this.createDisabledReason,
			onSelect: this.actions.openCreate,
		},
	]);

	constructor() {
		watch(
			() => [this.#params.current.create, this.actions.canWrite] as const,
			([create, canWrite]) => {
				if (!create || !canWrite) return;
				this.actions.openCreate();
				void this.#params.update({ create: undefined });
			}
		);
	}
}
