/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

const MAX_RETURN_TO_LENGTH = 2048;
const MAX_RETURN_TO_DEPTH = 8;
const RELATIVE_ORIGIN = 'http://localhost';
const DASHBOARD_HREF = resolve(Path.DASHBOARD);
const AUTH_PATHS: ReadonlySet<string> = new Set([
	resolve(Path.LOGIN),
	resolve(Path.SIGNUP),
]);

export const AUTH_RETURN_TO_PARAM = 'returnTo';

export function normalizeAuthReturnTo(value: string | null): string {
	if (!isSafeReturnTo(value)) return DASHBOARD_HREF;

	let target = value;
	for (let depth = 0; depth < MAX_RETURN_TO_DEPTH; depth += 1) {
		if (target.length > MAX_RETURN_TO_LENGTH) return DASHBOARD_HREF;

		const parsed = parseRelativePath(safeDecode(target));
		if (!parsed) return DASHBOARD_HREF;
		if (!AUTH_PATHS.has(parsed.pathname)) return parsed.path;

		const nestedReturnTo = parsed.search.get(AUTH_RETURN_TO_PARAM);
		if (!nestedReturnTo) return DASHBOARD_HREF;
		target = nestedReturnTo;
	}

	return DASHBOARD_HREF;
}

export function loginHref(returnTo: Pick<URL, 'pathname' | 'search'>): string {
	return authEntryHref(Path.LOGIN, `${returnTo.pathname}${returnTo.search}`);
}

export function authEntryHref(
	path: typeof Path.LOGIN | typeof Path.SIGNUP,
	returnTo: string | null
): string {
	const href = resolve(path);
	if (!returnTo) return href;
	const search = new URLSearchParams({
		[AUTH_RETURN_TO_PARAM]: normalizeAuthReturnTo(returnTo),
	});
	return `${href}?${search}`;
}

function isSafeReturnTo(value: string | null): value is string {
	return Boolean(
		value?.length && value.startsWith('/') && !value.startsWith('//')
	);
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function parseRelativePath(value: string): {
	path: string;
	pathname: string;
	search: URLSearchParams;
} | null {
	if (!isSafeReturnTo(value) || value.length > MAX_RETURN_TO_LENGTH)
		return null;

	try {
		const url = new URL(value, RELATIVE_ORIGIN);
		return {
			path: `${url.pathname}${url.search}${url.hash}`,
			pathname: url.pathname,
			search: url.searchParams,
		};
	} catch {
		return null;
	}
}
