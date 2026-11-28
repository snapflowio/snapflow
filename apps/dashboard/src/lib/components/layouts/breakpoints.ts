/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const BREAKPOINTS = {
	'2xl': 1536,
	'3xl': 1600,
	'4xl': 2000,
	lg: 1024,
	md: 800,
	sm: 640,
	xl: 1280,
} as const;
const MAX_PREFIX = 'max-';
const NEVER_MATCHING_QUERY = 'not all';

type Breakpoint = keyof typeof BREAKPOINTS;

type BreakpointQuery = Breakpoint | `${typeof MAX_PREFIX}${Breakpoint}`;

function isBreakpoint(value: string): value is Breakpoint {
	return Object.hasOwn(BREAKPOINTS, value);
}

export function breakpointQuery(query: BreakpointQuery): string {
	if (isBreakpoint(query)) return `(min-width: ${BREAKPOINTS[query]}px)`;
	const breakpoint = query.slice(MAX_PREFIX.length);
	return isBreakpoint(breakpoint)
		? `(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`
		: NEVER_MATCHING_QUERY;
}
