/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PersistedState } from 'runed';
import { MediaQuery } from 'svelte/reactivity';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import { BOOLEAN_SERIALIZER } from '#lib/utils/storage-serializers.ts';

const DOCKED_FILTER_SIDEBAR_BREAKPOINT = 'lg';

export class ResourceFilterSidebar {
	readonly #docked = new MediaQuery(
		breakpointQuery(DOCKED_FILTER_SIDEBAR_BREAKPOINT)
	);
	readonly #dockedOpen: PersistedState<boolean>;
	#overlayOpen = $state(false);

	constructor(storageKey: string) {
		this.#dockedOpen = new PersistedState(storageKey, true, {
			serializer: BOOLEAN_SERIALIZER,
			syncTabs: false,
		});
	}

	get open(): boolean {
		return this.#docked.current ? this.#dockedOpen.current : this.#overlayOpen;
	}

	get overlay(): boolean {
		return !this.#docked.current;
	}

	close = (): void => {
		this.#setOpen(false);
	};

	toggle = (): void => {
		this.#setOpen(!this.open);
	};

	#setOpen(next: boolean): void {
		if (this.#docked.current) {
			this.#dockedOpen.current = next;
		} else {
			this.#overlayOpen = next;
		}
	}
}
