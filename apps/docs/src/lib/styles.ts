/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const CHIP_GEOMETRY =
	'inline-flex h-(--control-height) items-center justify-center gap-1.5 rounded-frame px-2.5 text-small no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

const BUTTON_GEOMETRY =
	'inline-flex h-(--control-height) cursor-pointer items-center justify-center gap-1.5 font-mono text-xs font-bold tracking-wider no-underline transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4';

const SECONDARY_SURFACE =
	'chamfer-outline text-(--text-body) hover:text-(--text-primary) focus-visible:outline-brand';

export const PRIMARY_BUTTON = `${BUTTON_GEOMETRY} chamfer bg-brand px-4 text-(--text-on-brand) hover:bg-brand-hover focus-visible:outline-(--text-on-brand)`;

export const SECONDARY_BUTTON = `${BUTTON_GEOMETRY} ${SECONDARY_SURFACE} px-4`;

export const SECONDARY_ICON_BUTTON = `${BUTTON_GEOMETRY} ${SECONDARY_SURFACE} w-(--control-height)`;

export const NAV_ITEM = `${CHIP_GEOMETRY} px-2`;

export const NAV_ITEM_ACTIVE = 'bg-surface-active text-(--text-primary)';

export const NAV_ITEM_INACTIVE =
	'text-(--text-muted) hover:bg-surface-hover hover:text-(--text-body)';

export const MENU_SURFACE =
	'rounded-frame border border-border bg-bg p-1 text-(--text-body) shadow-medium';

export const MENU_ITEM =
	'flex h-(--control-height) items-center rounded-frame px-2 text-small text-(--text-body) no-underline transition-colors hover:bg-surface-hover';
