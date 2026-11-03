/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { watch } from 'runed';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';

export function consumeSearchParam(
	name: string,
	handle: (value: string) => void,
	ready: () => boolean = () => true
): void {
	let consumed: string | null = null;
	watch([() => page.url.searchParams.get(name), ready], ([value, isReady]) => {
		if (value === null || value === consumed || !isReady) return;
		consumed = value;
		const url = new URL(page.url.href);
		url.searchParams.delete(name);
		replaceState(url, page.state);
		handle(value);
	});
}
