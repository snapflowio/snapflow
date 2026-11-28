/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { PersistedState } from 'runed';
import { createContext } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { MediaQuery } from 'svelte/reactivity';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import {
	SIDEBAR_OPEN_STORAGE_KEY,
	SIDEBAR_STATE,
	SIDEBAR_WIDTH,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';

const APP_SHELL_ATTRIBUTE = 'data-app-shell';
const WIDTH_PROPERTY = '--sidebar-width';
const PIXEL_SUFFIX = 'px';

export class SidebarState {
	mobileOpen = $state(false);
	readonly #mobileQuery = new MediaQuery(breakpointQuery('max-md'));
	readonly #open = new PersistedState(SIDEBAR_OPEN_STORAGE_KEY, true);

	readonly isMobile = $derived(this.#mobileQuery.current);
	readonly collapsed = $derived(!this.isMobile && !this.#open.current);
	readonly state = $derived(
		this.collapsed ? SIDEBAR_STATE.COLLAPSED : SIDEBAR_STATE.EXPANDED
	);
	readonly width = $derived.by(() => {
		if (this.isMobile) return SIDEBAR_WIDTH.HIDDEN;
		return this.collapsed ? SIDEBAR_WIDTH.COLLAPSED : SIDEBAR_WIDTH.DESKTOP;
	});

	toggle = (): void => {
		if (this.isMobile) {
			this.mobileOpen = !this.mobileOpen;
			return;
		}
		this.#open.current = !this.#open.current;
	};

	closeMobile = (): void => {
		this.mobileOpen = false;
	};

	readonly attachDocument: Attachment<Document> = (target) => {
		const root = target.documentElement;
		root.setAttribute(APP_SHELL_ATTRIBUTE, '');
		root.style.setProperty(WIDTH_PROPERTY, `${this.width}${PIXEL_SUFFIX}`);
		return () => {
			root.removeAttribute(APP_SHELL_ATTRIBUTE);
			root.style.removeProperty(WIDTH_PROPERTY);
		};
	};
}

export const [getSidebar, setSidebar] = createContext<SidebarState>();
