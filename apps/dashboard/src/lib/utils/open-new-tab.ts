/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const EMPTY_TAB_URL = 'about:blank';
const NEW_TAB_TARGET = '_blank';
const POPUP_BLOCKED_MESSAGE =
	'The browser blocked the new tab. Allow pop-ups and retry.';

export async function openResolvedUrlInNewTab(
	resolveUrl: () => Promise<string>,
	onError: (error: unknown) => void
): Promise<void> {
	const openedWindow = window.open(EMPTY_TAB_URL, NEW_TAB_TARGET);
	if (!openedWindow) {
		onError(new Error(POPUP_BLOCKED_MESSAGE));
		return;
	}
	try {
		openedWindow.location.replace(await resolveUrl());
		openedWindow.opener = null;
	} catch (error) {
		openedWindow.close();
		onError(error);
	}
}
