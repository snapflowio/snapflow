/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useResizeObserver } from 'runed';
import type { Attachment } from 'svelte/attachments';

export interface MiddleTruncateOptions {
	text: string;
	head?: number;
	tail?: number;
}

const ELLIPSIS = '…';
const DEFAULT_HEAD = 4;
const DEFAULT_TAIL = 4;
const MIN_SIDE = 1;
const MIN_KEPT = 2 * MIN_SIDE;

function clip(text: string, headCount: number, tailCount: number): string {
	return `${text.slice(0, headCount)}${ELLIPSIS}${text.slice(text.length - tailCount)}`;
}

function fits(node: HTMLElement): boolean {
	return node.scrollWidth <= node.clientWidth;
}

function split(kept: number, head: number, tail: number): [number, number] {
	const preferred = head + tail;
	if (preferred === 0) {
		const headCount = Math.ceil(kept / 2);
		return [headCount, kept - headCount];
	}
	if (kept >= preferred) {
		const extra = kept - preferred;
		return [head + Math.ceil(extra / 2), tail + Math.floor(extra / 2)];
	}
	const scaled = Math.round((kept * head) / preferred);
	const headCount =
		head > 0 && tail > 0
			? Math.min(Math.max(scaled, MIN_SIDE), kept - MIN_SIDE)
			: scaled;
	return [headCount, kept - headCount];
}

function fit(node: HTMLElement, text: string, head: number, tail: number) {
	node.textContent = text;
	if (fits(node)) {
		node.removeAttribute('title');
		return;
	}
	node.title = text;
	if (text.length <= MIN_KEPT) return;
	let low = MIN_KEPT;
	let high = text.length - 1;
	let best = clip(text, ...split(MIN_KEPT, head, tail));
	while (low <= high) {
		const kept = Math.floor((low + high) / 2);
		const candidate = clip(text, ...split(kept, head, tail));
		node.textContent = candidate;
		if (fits(node)) {
			best = candidate;
			low = kept + 1;
		} else {
			high = kept - 1;
		}
	}
	node.textContent = best;
}

export function middleTruncate({
	text,
	head = DEFAULT_HEAD,
	tail = DEFAULT_TAIL,
}: MiddleTruncateOptions): Attachment<HTMLElement> {
	return (node) => {
		let width = -1;
		fit(node, text, head, tail);
		useResizeObserver(
			() => node,
			(entries) => {
				const next = entries[0]?.contentRect.width ?? node.clientWidth;
				if (next === width) return;
				width = next;
				fit(node, text, head, tail);
			}
		);
	};
}
