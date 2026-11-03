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
import { innerWidth } from 'svelte/reactivity/window';
import { breakpointQuery } from '#lib/components/layouts/breakpoints.ts';
import {
	clampSidebarWidth,
	maximumSidebarWidth,
	SIDEBAR_COLLAPSED_COOKIE,
	SIDEBAR_COOKIE_MAX_AGE_SECONDS,
	SIDEBAR_WIDTH,
	SIDEBAR_WIDTH_STORAGE_KEY,
} from '#lib/features/dashboard/lib/sidebar-constants.ts';
import { numberSerializer } from '#lib/utils/storage-serializers.ts';

const COOKIE_TRUE = '1';
const COOKIE_FALSE = '0';
const APP_SHELL_ATTRIBUTE = 'data-app-shell';
const COLLAPSED_ATTRIBUTE = 'data-sidebar-collapsed';
const EXPANDED_WIDTH_PROPERTY = '--sidebar-expanded-width';

function readCollapsedCookie(): boolean {
	const prefix = `${SIDEBAR_COLLAPSED_COOKIE}=`;
	const entry = document.cookie
		.split('; ')
		.find((cookie) => cookie.startsWith(prefix));
	return entry?.slice(prefix.length) === COOKIE_TRUE;
}

function writeCollapsedCookie(collapsed: boolean): void {
	const value = collapsed ? COOKIE_TRUE : COOKIE_FALSE;
	// biome-ignore lint/suspicious/noDocumentCookie: the collapsed flag must be readable synchronously before the first paint, which the async Cookie Store API cannot provide
	document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

export class SidebarState {
	collapsed = $state(readCollapsedCookie());
	mobileOpen = $state(false);
	readonly #mobileQuery = new MediaQuery(breakpointQuery('max-md'));
	readonly #storedWidth = new PersistedState(
		SIDEBAR_WIDTH_STORAGE_KEY,
		SIDEBAR_WIDTH.DEFAULT,
		{ serializer: numberSerializer(SIDEBAR_WIDTH.DEFAULT), syncTabs: false }
	);
	readonly #viewportWidth = $derived(innerWidth.current ?? window.innerWidth);

	readonly isMobile = $derived(this.#mobileQuery.current);
	readonly railCollapsed = $derived(!this.isMobile && this.collapsed);
	readonly expandedWidth = $derived(
		clampSidebarWidth(this.#storedWidth.current, this.#viewportWidth)
	);
	readonly resizeMaximum = $derived(maximumSidebarWidth(this.#viewportWidth));

	toggle = (): void => {
		if (this.isMobile) {
			this.mobileOpen = !this.mobileOpen;
			return;
		}
		this.setCollapsed(!this.collapsed);
	};

	setCollapsed = (collapsed: boolean): void => {
		this.collapsed = collapsed;
		writeCollapsedCookie(collapsed);
	};

	openMobile = (): void => {
		this.mobileOpen = true;
	};

	closeMobile = (): void => {
		this.mobileOpen = false;
	};

	clampWidth = (width: number): number =>
		clampSidebarWidth(width, this.#viewportWidth);

	commitWidth = (width: number): void => {
		this.#storedWidth.current = this.clampWidth(width);
	};

	readonly attachDocument: Attachment<Document> = (target) => {
		const root = target.documentElement;
		root.setAttribute(APP_SHELL_ATTRIBUTE, '');
		root.toggleAttribute(COLLAPSED_ATTRIBUTE, this.railCollapsed);
		root.style.setProperty(EXPANDED_WIDTH_PROPERTY, `${this.expandedWidth}px`);
		return () => {
			root.removeAttribute(APP_SHELL_ATTRIBUTE);
			root.removeAttribute(COLLAPSED_ATTRIBUTE);
			root.style.removeProperty(EXPANDED_WIDTH_PROPERTY);
		};
	};
}

export const [getSidebar, setSidebar] = createContext<SidebarState>();
