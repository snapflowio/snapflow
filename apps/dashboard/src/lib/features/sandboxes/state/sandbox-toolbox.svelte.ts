/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SystemExposureService } from '@snapflow/api-client';
import {
	createToolboxClient,
	type SandboxToolboxClient,
	type SandboxToolboxClientArgs,
} from '#lib/api/sandboxes/toolbox.ts';
import { SandboxSystemSession } from './sandbox-system-session.svelte.ts';

export class SandboxToolbox {
	readonly client: SandboxToolboxClient | null;
	readonly #session: SandboxSystemSession;

	constructor(args: () => SandboxToolboxClientArgs) {
		this.#session = new SandboxSystemSession(() => ({
			enabled: args().enabled,
			sandbox: args().sandbox,
			service: SystemExposureService.Toolbox,
		}));
		const sandboxId = $derived(args().sandbox.id);
		const origin = $derived(
			this.#session.query.data
				? new URL(this.#session.query.data.url).origin
				: null
		);
		this.client = $derived(
			origin === null
				? null
				: { client: createToolboxClient(origin), sandboxId }
		);
	}

	get isPending(): boolean {
		return this.#session.query.isPending;
	}

	get error(): Error | null {
		return this.#session.query.error;
	}

	refresh = (): Promise<void> => this.#session.refresh();
}
