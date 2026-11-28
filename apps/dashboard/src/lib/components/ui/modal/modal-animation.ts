/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const ANIMATION_CLASSES =
	'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:animate-none';
export const MODAL_ANIMATION_DURATION_CLASS =
	'duration-(--motion-emphasis) ease-enter data-[state=closed]:duration-(--motion-standard) data-[state=closed]:ease-exit';
export const PANEL_MOTION_CLASS =
	'data-[state=open]:zoom-in-99 data-[state=closed]:zoom-out-99';
export const SHEET_MOTION_CLASS =
	'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right';
export const OVERLAY_ANIMATION_DURATION_CLASS =
	'duration-(--motion-quick) ease-out';
