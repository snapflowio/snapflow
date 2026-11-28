/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const DESKTOP_VIEWER_PATH = '/vnc.html';
const DESKTOP_VIEWER_PARAMETERS = { autoconnect: 'true', resize: 'remote' };

export function desktopViewerUrl(accessUrl: string): string {
	const url = new URL(accessUrl);
	url.pathname = DESKTOP_VIEWER_PATH;
	for (const [name, value] of Object.entries(DESKTOP_VIEWER_PARAMETERS)) {
		url.searchParams.set(name, value);
	}
	return url.toString();
}
