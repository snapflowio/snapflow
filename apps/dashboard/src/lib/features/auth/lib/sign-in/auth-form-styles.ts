/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const AUTH_CONTROL_HEIGHT = 'h-9';

export const AUTH_BUTTON_CLASS = `${AUTH_CONTROL_HEIGHT} justify-center [&>span]:flex-none`;

export const AUTH_OUTLINE_BUTTON_CLASS = `${AUTH_BUTTON_CLASS} border border-border`;

export const AUTH_TEXT_LINK_CLASS =
	'cursor-pointer text-(--text-secondary) underline-offset-4 transition-colors hover:text-(--text-primary) hover:underline disabled:cursor-not-allowed disabled:opacity-50';
