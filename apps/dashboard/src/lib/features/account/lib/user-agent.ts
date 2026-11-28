/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

interface UserAgentPattern {
	label: string;
	pattern: RegExp;
}

const UNKNOWN_DEVICE = 'Unknown device';
const UNKNOWN_BROWSER = 'Browser';

const BROWSERS: readonly UserAgentPattern[] = [
	{ label: 'Snapflow CLI', pattern: /snapflow/i },
	{ label: 'Edge', pattern: /Edg(e|A|iOS)?\// },
	{ label: 'Opera', pattern: /OPR\/|Opera/ },
	{ label: 'Samsung Internet', pattern: /SamsungBrowser\// },
	{ label: 'Firefox', pattern: /Firefox\/|FxiOS\// },
	{ label: 'Chrome', pattern: /Chrome\/|CriOS\// },
	{ label: 'Safari', pattern: /Safari\// },
	{ label: 'curl', pattern: /^curl\// },
	{ label: 'Node.js', pattern: /node|undici/i },
];

const SYSTEMS: readonly UserAgentPattern[] = [
	{ label: 'iOS', pattern: /iPhone|iPad|iPod/ },
	{ label: 'Android', pattern: /Android/ },
	{ label: 'ChromeOS', pattern: /CrOS/ },
	{ label: 'Windows', pattern: /Windows/ },
	{ label: 'macOS', pattern: /Mac OS X|Macintosh/ },
	{ label: 'Linux', pattern: /Linux/ },
];

function firstMatch(
	patterns: readonly UserAgentPattern[],
	userAgent: string
): string | null {
	return patterns.find(({ pattern }) => pattern.test(userAgent))?.label ?? null;
}

export function deviceLabel(userAgent: string | null | undefined): string {
	const value = userAgent?.trim();
	if (!value) return UNKNOWN_DEVICE;
	const browser = firstMatch(BROWSERS, value);
	const system = firstMatch(SYSTEMS, value);
	if (browser && system) return `${browser} on ${system}`;
	if (browser) return browser;
	if (system) return `${UNKNOWN_BROWSER} on ${system}`;
	return UNKNOWN_DEVICE;
}
