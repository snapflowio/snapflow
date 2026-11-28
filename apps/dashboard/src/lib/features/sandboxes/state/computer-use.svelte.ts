/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	getComputerUseStatus,
	startComputerUse,
} from '@snapflow/toolbox-api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import type { SandboxToolboxClient } from '#lib/api/sandboxes/toolbox.ts';

const COMPUTER_USE_ACTIVE_STATUS = 'active';
const COMPUTER_USE_UNAVAILABLE_CODE = 'COMPUTER_USE_UNAVAILABLE';
const COMPUTER_USE_POLL_ATTEMPTS = 10;
const COMPUTER_USE_POLL_INTERVAL_MILLISECONDS = 2_000;
const COMPUTER_USE_STATUS_QUERY_SCOPE = 'computer-use-status';
const TOOLBOX_DISCONNECTED_MESSAGE = 'Sandbox toolbox is not connected.';

export interface ComputerUseArgs {
	enabled: boolean;
	sandboxId: string;
	toolbox: SandboxToolboxClient | null;
}

function connectedToolbox(
	toolbox: SandboxToolboxClient | null
): SandboxToolboxClient {
	if (!toolbox) throw new SnapflowError(TOOLBOX_DISCONNECTED_MESSAGE);
	return toolbox;
}

async function readComputerUseStatus(toolbox: SandboxToolboxClient) {
	return (await getComputerUseStatus({ client: toolbox.client })).data.status;
}

function waitForComputerUsePoll(): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, COMPUTER_USE_POLL_INTERVAL_MILLISECONDS);
	});
}

async function waitForComputerUse(toolbox: SandboxToolboxClient) {
	for (let attempt = 0; attempt < COMPUTER_USE_POLL_ATTEMPTS; attempt += 1) {
		if ((await readComputerUseStatus(toolbox)) === COMPUTER_USE_ACTIVE_STATUS) {
			return;
		}
		await waitForComputerUsePoll();
	}
	throw new SnapflowError('The desktop did not become ready in time.', {
		retryable: true,
	});
}

export class ComputerUse {
	readonly #enabled: boolean;
	readonly #status;
	readonly #start;

	constructor(args: () => ComputerUseArgs) {
		this.#enabled = $derived(args().enabled && args().toolbox !== null);
		this.#status = createQuery(() => {
			const { sandboxId, toolbox } = args();
			return {
				queryKey: [COMPUTER_USE_STATUS_QUERY_SCOPE, sandboxId] as const,
				queryFn: () => readComputerUseStatus(connectedToolbox(toolbox)),
				enabled: this.#enabled,
				retry: false,
				staleTime: 0,
			};
		});
		this.#start = createMutation(() => {
			const { toolbox } = args();
			return {
				mutationFn: async () => {
					const connected = connectedToolbox(toolbox);
					await startComputerUse({ client: connected.client });
					await waitForComputerUse(connected);
				},
				onSuccess: async () => {
					await this.#status.refetch();
				},
				meta: { failure: 'Failed to start sandbox desktop' },
			};
		});
	}

	get active(): boolean {
		return this.#status.data === COMPUTER_USE_ACTIVE_STATUS;
	}

	get error(): Error | null {
		return this.#status.error ?? this.#start.error;
	}

	get unavailable(): boolean {
		return (
			this.error !== null &&
			SnapflowError.fromUnknown(this.error).code ===
				COMPUTER_USE_UNAVAILABLE_CODE
		);
	}

	get isPending(): boolean {
		return (this.#enabled && this.#status.isPending) || this.#start.isPending;
	}

	retry = async (): Promise<void> => {
		this.#start.reset();
		await this.#status.refetch();
	};

	start = (): void => {
		this.#start.mutate();
	};
}
