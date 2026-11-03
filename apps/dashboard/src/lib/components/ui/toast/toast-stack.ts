/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { STACK_LIMIT, type ToastData } from './toast-model.ts';

export const TOAST_WIDTH = 'min(100vw - 2rem, 280px)';
export const VIEWPORT_INSET_PX = 16;
export const CARD_BORDER_PX = 2;
const COLLAPSED_OFFSET_PX = 13;
const COLLAPSED_SCALE_STEP = 0.05;
const EXPAND_GAP_PX = 8;
const ESTIMATED_TOAST_HEIGHT = 56;
const COMPACT_CARD_HEIGHT_PX = 46;
const COMPACT_RADIUS_PX = 12;
const CONCENTRIC_RADIUS_PX = 16;

export interface ToastGeometry {
	y: number;
	scale: number;
	height: number;
	zIndex: number;
}

export interface ToastStackEntry {
	toast: ToastData;
	geometry: ToastGeometry;
}

export interface ToastStack {
	layout: ToastStackEntry[];
	containerHeight: number;
}

export function cardRadiusPx(height: number): number {
	return height <= COMPACT_CARD_HEIGHT_PX
		? COMPACT_RADIUS_PX
		: CONCENTRIC_RADIUS_PX;
}

export function layoutToastStack(
	items: readonly ToastData[],
	heights: ReadonlyMap<string, number>,
	expanded: boolean
): ToastStack {
	const ordered = [...items].reverse();
	const frontHeight =
		heights.get(ordered[0]?.id ?? '') ?? ESTIMATED_TOAST_HEIGHT;
	let cumulative = 0;
	const layout = ordered.map((toast, index): ToastStackEntry => {
		const naturalHeight = heights.get(toast.id) ?? ESTIMATED_TOAST_HEIGHT;
		const offsetBefore = cumulative;
		cumulative += naturalHeight + EXPAND_GAP_PX;
		return {
			toast,
			geometry: {
				y: expanded ? -offsetBefore : -index * COLLAPSED_OFFSET_PX,
				scale: expanded ? 1 : 1 - index * COLLAPSED_SCALE_STEP,
				height: expanded || index === 0 ? naturalHeight : frontHeight,
				zIndex: ordered.length - index,
			},
		};
	});
	const collapsedHeight =
		frontHeight +
		Math.max(0, Math.min(ordered.length, STACK_LIMIT) - 1) *
			COLLAPSED_OFFSET_PX;
	const expandedHeight =
		cumulative > 0 ? cumulative - EXPAND_GAP_PX : frontHeight;
	return {
		layout,
		containerHeight: expanded ? expandedHeight : collapsedHeight,
	};
}
