/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Bell from '@lucide/svelte/icons/bell';
import CircleAlert from '@lucide/svelte/icons/circle-alert';
import CircleCheck from '@lucide/svelte/icons/circle-check';
import CircleInfo from '@lucide/svelte/icons/info';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import type { ToastVariant } from './toast-model.ts';

export const VARIANT_ICON: Record<ToastVariant, IconComponent> = {
	default: Bell,
	info: CircleInfo,
	success: CircleCheck,
	warning: TriangleAlert,
	error: CircleAlert,
};
