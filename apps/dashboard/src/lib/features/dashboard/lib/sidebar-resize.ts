/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const SIDEBAR_WIDTH_PROPERTY = '--sidebar-width';

export const SIDEBAR_RESIZING_CLASS = 'sidebar-resizing';

export function previewSidebarWidth(
	shell: HTMLElement | undefined,
	width: number
): void {
	shell?.style.setProperty(SIDEBAR_WIDTH_PROPERTY, `${width}px`);
}

export function clearSidebarWidthPreview(shell: HTMLElement | undefined): void {
	shell?.style.removeProperty(SIDEBAR_WIDTH_PROPERTY);
}
