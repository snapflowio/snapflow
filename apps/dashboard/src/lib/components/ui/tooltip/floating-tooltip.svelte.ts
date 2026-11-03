/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useInterval } from 'runed';
import { createContext } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { on } from 'svelte/events';
import {
	clamp,
	type FloatingTooltipState,
	getTooltipPosition,
	HIDDEN_STATE,
	isFocusVisible,
	isVisiblyRendered,
	NEUTRAL_MOTION,
	quantize,
	type TooltipMotion,
} from './tooltip-geometry.ts';

const SKEW_PER_VELOCITY = 0.11;
const MAXIMUM_SKEW_DEGREES = 6;
const MAXIMUM_STRETCH = 0.035;
const STRETCH_VELOCITY = 1100;
const MAXIMUM_SQUASH = 0.02;
const SQUASH_VELOCITY = 1500;

const MIN_FRAME_MS = 16;
const TRIGGER_VISIBILITY_INTERVAL_MS = 150;
const VELOCITY_TIME_CONSTANT_MS = 50;

interface PointerSnapshot {
	x: number;
	y: number;
	time: number;
}

function sameState(
	current: FloatingTooltipState,
	next: Omit<FloatingTooltipState, 'visible'>
): boolean {
	return (
		current.visible &&
		current.x === next.x &&
		current.y === next.y &&
		current.alignX === next.alignX &&
		current.alignY === next.alignY &&
		current.skew === next.skew &&
		current.scaleX === next.scaleX &&
		current.scaleY === next.scaleY
	);
}

export class FloatingTooltipTracker {
	state: FloatingTooltipState = $state.raw(HIDDEN_STATE);
	readonly contentId: string;
	readonly #preferAboveOption: () => boolean;
	#lastPointer: PointerSnapshot | null = null;
	#velocity = { x: 0, magnitude: 0 };
	#trigger: HTMLElement | null = null;
	readonly #visibilityCheck = useInterval(TRIGGER_VISIBILITY_INTERVAL_MS, {
		immediate: false,
		callback: () => this.#checkTriggerVisibility(),
	});

	constructor(contentId: string, preferAbove: () => boolean) {
		this.contentId = contentId;
		this.#preferAboveOption = preferAbove;
	}

	get describedBy(): string | undefined {
		return this.state.visible ? this.contentId : undefined;
	}

	get #preferAbove(): boolean {
		return this.#preferAboveOption();
	}

	#reset(): void {
		this.#lastPointer = null;
		this.#velocity.x = 0;
		this.#velocity.magnitude = 0;
	}

	#hide = (): void => {
		this.#reset();
		this.#trigger = null;
		this.#visibilityCheck.pause();
		if (this.state.visible) this.state = HIDDEN_STATE;
	};

	#checkTriggerVisibility = (): void => {
		const trigger = this.#trigger;
		if (!trigger || !isVisiblyRendered(trigger)) this.#hide();
	};

	#apply(clientX: number, clientY: number, motion: TooltipMotion): void {
		const next = {
			...getTooltipPosition(clientX, clientY, this.#preferAbove),
			...motion,
		};
		if (sameState(this.state, next)) return;
		if (!this.state.visible) this.#visibilityCheck.resume();
		this.state = { visible: true, ...next };
	}

	#nextMotion(event: PointerEvent, now: number): TooltipMotion {
		const previous = this.#lastPointer;
		const delta = previous ? Math.max(now - previous.time, 1) : MIN_FRAME_MS;
		const perFrame = Math.max(delta, MIN_FRAME_MS);
		const instantX = previous
			? ((event.clientX - previous.x) / perFrame) * MIN_FRAME_MS
			: 0;
		const instantY = previous
			? ((event.clientY - previous.y) / perFrame) * MIN_FRAME_MS
			: 0;
		const smoothing = 1 - Math.exp(-delta / VELOCITY_TIME_CONSTANT_MS);
		const velocity = this.#velocity;
		velocity.x += (instantX - velocity.x) * smoothing;
		velocity.magnitude +=
			(Math.hypot(instantX, instantY) - velocity.magnitude) * smoothing;
		return {
			skew: quantize(
				clamp(
					velocity.x * SKEW_PER_VELOCITY,
					-MAXIMUM_SKEW_DEGREES,
					MAXIMUM_SKEW_DEGREES
				)
			),
			scaleX: quantize(
				1 + Math.min(MAXIMUM_STRETCH, velocity.magnitude / STRETCH_VELOCITY)
			),
			scaleY: quantize(
				1 - Math.min(MAXIMUM_SQUASH, velocity.magnitude / SQUASH_VELOCITY)
			),
		};
	}

	#enter(trigger: HTMLElement, event: PointerEvent): void {
		this.#trigger = trigger;
		this.#reset();
		this.#lastPointer = {
			x: event.clientX,
			y: event.clientY,
			time: performance.now(),
		};
		this.#apply(event.clientX, event.clientY, NEUTRAL_MOTION);
	}

	#move(trigger: HTMLElement, event: PointerEvent): void {
		this.#trigger = trigger;
		const now = performance.now();
		const motion = this.#nextMotion(event, now);
		this.#lastPointer = { x: event.clientX, y: event.clientY, time: now };
		this.#apply(event.clientX, event.clientY, motion);
	}

	#focus(trigger: HTMLElement): void {
		if (!isFocusVisible(trigger)) return;
		this.#trigger = trigger;
		const rect = trigger.getBoundingClientRect();
		this.#reset();
		this.#apply(
			rect.left + rect.width / 2,
			this.#preferAbove ? rect.top : rect.bottom,
			NEUTRAL_MOTION
		);
	}

	readonly track: Attachment<HTMLElement> = (trigger) => {
		const unlessPrevented =
			<E extends Event>(handler: (event: E) => void) =>
			(event: E) => {
				if (!event.defaultPrevented) handler(event);
			};
		const listeners = [
			on(
				trigger,
				'pointerenter',
				unlessPrevented((event) => this.#enter(trigger, event))
			),
			on(
				trigger,
				'pointermove',
				unlessPrevented((event) => this.#move(trigger, event))
			),
			on(trigger, 'pointerleave', unlessPrevented(this.#hide)),
			on(trigger, 'pointerdown', unlessPrevented(this.#hide)),
			on(
				trigger,
				'focus',
				unlessPrevented(() => this.#focus(trigger))
			),
			on(trigger, 'blur', unlessPrevented(this.#hide)),
		];
		return () => {
			for (const off of listeners) off();
			if (this.#trigger === trigger) this.#hide();
		};
	};
}

export const [getTooltip, setTooltip] = createContext<FloatingTooltipTracker>();
