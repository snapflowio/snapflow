/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { AbuseHostnameKind } from '../constants/abuse-report.constants';

const CAPTURABLE_HOSTNAME_KINDS: ReadonlySet<AbuseHostnameKind> = new Set([
	AbuseHostnameKind.PREVIEW,
	AbuseHostnameKind.ORIGIN,
]);

export function reportedHostnames(url: string): string[] {
	const parsed = new URL(url);
	const hostname = parsed.hostname.toLowerCase();
	return parsed.port ? [`${hostname}:${parsed.port}`, hostname] : [hostname];
}

export function capturableReportUrl(
	url: string,
	kind: AbuseHostnameKind
): string | null {
	return CAPTURABLE_HOSTNAME_KINDS.has(kind) ? url : null;
}
