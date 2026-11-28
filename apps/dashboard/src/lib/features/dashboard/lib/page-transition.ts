/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { prefersReducedMotion } from 'svelte/motion';
import type { onNavigate } from '$app/navigation';

type PageNavigation = Parameters<Parameters<typeof onNavigate>[0]>[0];

export function crossFadePage(
	navigation: PageNavigation
): Promise<void> | void {
	if (typeof document.startViewTransition !== 'function') return;
	if (prefersReducedMotion.current || navigation.willUnload) return;
	if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
	return new Promise((resolve) => {
		document.startViewTransition(async () => {
			resolve();
			await navigation.complete;
		});
	});
}
