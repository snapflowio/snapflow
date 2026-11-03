/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const TOOLTIP_OFFSET = 16;
const EDGE_GUTTER = 16;
const EDGE_THRESHOLD = 360;
export interface FloatingTooltipState {
	visible: boolean;
	x: number;
	y: number;
	skew: number;
	scaleX: number;
	scaleY: number;
	alignX: 'left' | 'right';
	alignY: 'above' | 'below';
}
export interface TooltipMotion {
	skew: number;
	scaleX: number;
	scaleY: number;
}
export const NEUTRAL_MOTION: TooltipMotion = { skew: 0, scaleX: 1, scaleY: 1 };
export const HIDDEN_STATE: FloatingTooltipState = {
	visible: false,
	x: 0,
	y: 0,
	...NEUTRAL_MOTION,
	alignX: 'left',
	alignY: 'below',
};
export function isVisiblyRendered(element: HTMLElement): boolean {
	if (!element.isConnected) return false;
	if (typeof element.checkVisibility === 'function') {
		return element.checkVisibility({
			checkVisibilityCSS: true,
			visibilityProperty: true,
		});
	}
	if (getComputedStyle(element).visibility === 'hidden') return false;
	for (
		let node: HTMLElement | null = element;
		node;
		node = node.parentElement
	) {
		if (getComputedStyle(node).display === 'none') return false;
	}
	return true;
}
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
const QUANTIZE_SCALE = 1000;
export function quantize(value: number): number {
	return Math.round(value * QUANTIZE_SCALE) / QUANTIZE_SCALE;
}
export function isFocusVisible(element: Element): boolean {
	try {
		return element.matches(':focus-visible');
	} catch {
		return true;
	}
}
export function getTooltipPosition(
	clientX: number,
	clientY: number,
	preferAbove = false
): Pick<FloatingTooltipState, 'x' | 'y' | 'alignX' | 'alignY'> {
	if (typeof window === 'undefined') {
		return {
			x: Math.round(clientX),
			y: Math.round(clientY),
			alignX: 'left',
			alignY: preferAbove ? 'above' : 'below',
		};
	}
	const alignX =
		window.innerWidth - clientX < EDGE_THRESHOLD ? 'right' : 'left';
	const nearTop = clientY < EDGE_THRESHOLD / 2;
	const nearBottom = window.innerHeight - clientY < EDGE_THRESHOLD / 2;
	const alignY = preferAbove
		? nearTop
			? 'below'
			: 'above'
		: nearBottom
			? 'above'
			: 'below';
	return {
		x: Math.round(clamp(clientX, EDGE_GUTTER, window.innerWidth - EDGE_GUTTER)),
		y: Math.round(
			clamp(clientY, EDGE_GUTTER, window.innerHeight - EDGE_GUTTER)
		),
		alignX,
		alignY,
	};
}
export function getTooltipTranslate(
	state: FloatingTooltipState,
	offset: number
): string {
	const x =
		state.alignX === 'left'
			? `${state.x + offset}px`
			: `calc(${state.x - offset}px - 100%)`;
	const y =
		state.alignY === 'below'
			? `${state.y + offset}px`
			: `calc(${state.y - offset}px - 100%)`;
	return `${x} ${y}`;
}
