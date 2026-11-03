/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ResolvedPathname } from '$app/types';

export const AUTO_DISMISS_MS = 5000;
export const STACK_LIMIT = 3;

export type ToastVariant = 'default' | 'info' | 'success' | 'warning' | 'error';

export type ToastAction =
	| { label: string; onClick: () => void }
	| { label: string; to: ResolvedPathname };

export interface ToastData {
	id: string;
	message: string;
	description?: string;
	variant: ToastVariant;
	action?: ToastAction;
	duration: number;
	persistAcrossRoutes: boolean;
}

export type ToastInput = {
	message: string;
	description?: string;
	variant?: ToastVariant;
	action?: ToastAction;
	duration?: number;
	persistAcrossRoutes?: boolean;
};
