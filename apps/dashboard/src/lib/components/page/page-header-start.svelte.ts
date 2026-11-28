/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type Snippet, untrack } from 'svelte';

class PageHeaderStart {
	content = $state.raw<Snippet | null>(null);
	#claims = $state(0);

	readonly claimed = $derived(this.#claims > 0);

	provide(content: Snippet): () => void {
		this.content = content;
		return () => {
			if (untrack(() => this.content) === content) this.content = null;
		};
	}

	claim(): () => void {
		untrack(() => {
			this.#claims += 1;
		});
		return () => {
			untrack(() => {
				this.#claims -= 1;
			});
		};
	}
}

export const pageHeaderStart = new PageHeaderStart();
