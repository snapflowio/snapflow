/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useMutationObserver, useResizeObserver } from 'runed';
import type { Attachment } from 'svelte/attachments';
import { on } from 'svelte/events';

const EDGE_TOLERANCE_PX = 1;

const EDGE_ATTRIBUTES = {
	top: 'data-scroll-fade-top',
	bottom: 'data-scroll-fade-bottom',
	left: 'data-scroll-fade-left',
	right: 'data-scroll-fade-right',
} as const;

export interface ScrollEdges {
	top: boolean;
	bottom: boolean;
	left: boolean;
	right: boolean;
}

export function hiddenScrollEdges(element: HTMLElement): ScrollEdges {
	const maxTop = element.scrollHeight - element.clientHeight;
	const maxLeft = element.scrollWidth - element.clientWidth;
	return {
		top: element.scrollTop > EDGE_TOLERANCE_PX,
		bottom: maxTop - element.scrollTop > EDGE_TOLERANCE_PX,
		left: element.scrollLeft > EDGE_TOLERANCE_PX,
		right: maxLeft - element.scrollLeft > EDGE_TOLERANCE_PX,
	};
}

export function scrollEdges(
	onChange?: (edges: ScrollEdges) => void
): Attachment<HTMLElement> {
	return (element) => {
		const update = () => {
			const edges = hiddenScrollEdges(element);
			for (const edge of Object.keys(
				EDGE_ATTRIBUTES
			) as (keyof ScrollEdges)[]) {
				element.toggleAttribute(EDGE_ATTRIBUTES[edge], edges[edge]);
			}
			onChange?.(edges);
		};
		useResizeObserver(() => element, update);
		useMutationObserver(() => element, update, {
			childList: true,
			subtree: true,
		});
		update();
		return on(element, 'scroll', update, { passive: true });
	};
}
