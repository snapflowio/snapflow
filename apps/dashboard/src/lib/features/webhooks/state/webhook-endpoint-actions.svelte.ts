/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { WebhookEndpoint } from '@snapflow/api-client';
import { createMutation } from '@tanstack/svelte-query';
import {
	createWebhookEndpointMutationOptions,
	deleteWebhookEndpointMutationOptions,
	rotateWebhookSecretMutationOptions,
	sendWebhookTestMutationOptions,
	updateWebhookEndpointMutationOptions,
} from '#lib/api/webhooks.ts';
import { submitMutation } from '#lib/components/form/submit.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import {
	toWebhookEndpointBody,
	type WebhookEndpointFormValues,
} from '#lib/features/webhooks/lib/webhook-endpoint-form.ts';

export interface RevealedWebhookSecret {
	secret: string;
	url: string;
	rotated: boolean;
}

function createTestMutation(viewedEndpointId: () => string | undefined) {
	return createMutation(() =>
		sendWebhookTestMutationOptions(viewedEndpointId())
	);
}

export class WebhookEndpointActions {
	readonly #permission = getOrganizationPermission();

	readonly #createMutation = createMutation(() =>
		createWebhookEndpointMutationOptions()
	);
	readonly updateMutation = createMutation(() =>
		updateWebhookEndpointMutationOptions()
	);
	readonly deleteMutation = createMutation(() =>
		deleteWebhookEndpointMutationOptions()
	);
	readonly rotateMutation = createMutation(() =>
		rotateWebhookSecretMutationOptions()
	);
	readonly testMutation: ReturnType<typeof createTestMutation>;

	readonly canWrite = $derived(this.#permission.can({ webhooks: ['write'] }));
	readonly canDelete = $derived(this.#permission.can({ webhooks: ['delete'] }));

	formOpen = $state(false);
	editing = $state.raw<WebhookEndpoint | null>(null);
	deleting = $state.raw<WebhookEndpoint | null>(null);
	rotating = $state.raw<WebhookEndpoint | null>(null);
	revealed = $state.raw<RevealedWebhookSecret | null>(null);

	readonly #onDeleted: () => void;

	constructor(
		viewedEndpointId: () => string | undefined,
		onDeleted: () => void
	) {
		this.testMutation = createTestMutation(viewedEndpointId);
		this.#onDeleted = onDeleted;
	}

	openCreate = (): void => {
		this.editing = null;
		this.formOpen = true;
	};

	openEdit = (endpoint: WebhookEndpoint): void => {
		this.editing = endpoint;
		this.formOpen = true;
	};

	changeFormOpen = (open: boolean): void => {
		this.formOpen = open;
		if (!open) this.editing = null;
	};

	submit = (values: WebhookEndpointFormValues): Promise<boolean> =>
		submitMutation(async () => {
			const body = toWebhookEndpointBody(values);
			if (this.editing) {
				await this.updateMutation.mutateAsync({
					endpoint: this.editing,
					body,
				});
			} else {
				const created = await this.#createMutation.mutateAsync(body);
				this.revealed = {
					secret: created.secret,
					url: created.endpoint.url,
					rotated: false,
				};
			}
			this.changeFormOpen(false);
		});

	setEnabled = (endpoint: WebhookEndpoint, enabled: boolean): void => {
		this.updateMutation.mutate({ endpoint, body: { enabled } });
	};

	sendTest = (endpoint: WebhookEndpoint): void => {
		this.testMutation.mutate(endpoint);
	};

	rotate = (endpoint: WebhookEndpoint): void => {
		this.rotateMutation.mutate(endpoint, {
			onSuccess: (result) => {
				this.rotating = null;
				this.revealed = {
					secret: result.secret,
					url: result.endpoint.url,
					rotated: true,
				};
			},
		});
	};

	remove = (endpoint: WebhookEndpoint): void => {
		this.deleteMutation.mutate(endpoint, {
			onSuccess: () => {
				this.deleting = null;
				this.#onDeleted();
			},
		});
	};

	closeSecret = (): void => {
		this.rotating = null;
		this.revealed = null;
	};
}
