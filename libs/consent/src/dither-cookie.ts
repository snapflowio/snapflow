/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	ALPHA_CHANNEL,
	AMBIENT_LIGHT,
	BAYER_LEVELS,
	BAYER_MATRIX,
	BAYER_SIZE,
	BITE_DURATION_MILLISECONDS,
	BITES,
	CENTER,
	CHIP_TONE_PROPERTY,
	CHIPS,
	COOKIE_RADIUS,
	COOKIE_SPACE,
	COOKIE_TONE_PROPERTIES,
	DIRECT_LIGHT,
	DISSOLVE_DURATION_MILLISECONDS,
	DITHER_CELL_SIZE,
	EASE_OUT_POWER,
	EDGE_WOBBLE,
	INITIAL_LIGHT_ANGLE,
	LIGHT_ELEVATION,
	LIGHT_RADIANS_PER_MILLISECOND,
	OPAQUE,
	PIXEL_CENTER,
	RGB_CHANNELS,
	RGBA_CHANNELS,
	TEXTURE_MIDPOINT,
	TEXTURE_SEED_SCALE,
	TEXTURE_SEED_X,
	TEXTURE_SEED_Y,
	TEXTURE_STRENGTH,
} from './dither-cookie.constants.js';

export const CookieOutcome = {
	ACCEPT: 'accept',
	REJECT: 'reject',
} as const;

export type CookieOutcome = (typeof CookieOutcome)[keyof typeof CookieOutcome];

function bayerThreshold(x: number, y: number): number {
	return (
		((BAYER_MATRIX[(y % BAYER_SIZE) * BAYER_SIZE + (x % BAYER_SIZE)] ?? 0) +
			PIXEL_CENTER) /
		BAYER_LEVELS
	);
}

function texture(x: number, y: number): number {
	const seed =
		Math.sin(x * TEXTURE_SEED_X + y * TEXTURE_SEED_Y) * TEXTURE_SEED_SCALE;
	return seed - Math.floor(seed);
}

function edgeRadius(angle: number): number {
	return EDGE_WOBBLE.reduce(
		(radius, { frequency, amplitude, phase }) =>
			radius + amplitude * Math.sin(frequency * angle + phase),
		COOKIE_RADIUS
	);
}

function easeOut(progress: number): number {
	return 1 - (1 - progress) ** EASE_OUT_POWER;
}

function insideBite(dx: number, dy: number, progress: number): boolean {
	return BITES.some(
		({ x, y, radius }) => Math.hypot(dx - x, dy - y) < radius * progress
	);
}

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class DitherCookie {
	private readonly context: CanvasRenderingContext2D;
	private readonly image: ImageData;
	private readonly grid: number;
	private readonly scale: number;
	private readonly tones: Uint8ClampedArray[];
	private readonly chipTone: Uint8ClampedArray;
	private frame: number | undefined;
	private lightAngle = INITIAL_LIGHT_ANGLE;
	private bite = 0;
	private dissolve = 0;

	constructor(canvas: HTMLCanvasElement) {
		this.grid = Math.max(1, Math.round(canvas.clientWidth / DITHER_CELL_SIZE));
		this.scale = COOKIE_SPACE / this.grid;
		canvas.width = this.grid;
		canvas.height = this.grid;
		const context = canvas.getContext('2d', { willReadFrequently: true });
		if (!context) {
			throw new Error('The dithered cookie needs a 2D canvas context.');
		}
		this.context = context;
		this.image = context.createImageData(this.grid, this.grid);
		const style = getComputedStyle(canvas);
		this.tones = COOKIE_TONE_PROPERTIES.map((property) =>
			this.toneOf(style.getPropertyValue(property))
		);
		this.chipTone = this.toneOf(style.getPropertyValue(CHIP_TONE_PROPERTY));
	}

	start(): void {
		this.render();
		if (prefersReducedMotion()) {
			return;
		}
		const origin = performance.now();
		const tick = (now: number) => {
			this.lightAngle =
				INITIAL_LIGHT_ANGLE + (now - origin) * LIGHT_RADIANS_PER_MILLISECOND;
			this.render();
			this.frame = requestAnimationFrame(tick);
		};
		this.frame = requestAnimationFrame(tick);
	}

	stop(): void {
		if (this.frame !== undefined) {
			cancelAnimationFrame(this.frame);
			this.frame = undefined;
		}
	}

	async play(outcome: CookieOutcome): Promise<void> {
		if (prefersReducedMotion()) {
			this.stop();
			return;
		}
		if (outcome === CookieOutcome.ACCEPT) {
			await this.animate(BITE_DURATION_MILLISECONDS, (progress) => {
				this.bite = easeOut(progress);
			});
		}
		await this.animate(DISSOLVE_DURATION_MILLISECONDS, (progress) => {
			this.dissolve = progress;
		});
		this.stop();
	}

	private animate(
		duration: number,
		update: (progress: number) => void
	): Promise<void> {
		return new Promise((resolve) => {
			const origin = performance.now();
			const step = (now: number) => {
				const progress = Math.min(1, (now - origin) / duration);
				update(progress);
				if (progress < 1) {
					requestAnimationFrame(step);
					return;
				}
				resolve();
			};
			requestAnimationFrame(step);
		});
	}

	private toneOf(color: string): Uint8ClampedArray {
		this.context.clearRect(0, 0, 1, 1);
		this.context.fillStyle = color;
		this.context.fillRect(0, 0, 1, 1);
		return this.context.getImageData(0, 0, 1, 1).data.slice(0, RGB_CHANNELS);
	}

	private shade(dx: number, dy: number, radius: number): number {
		const distance = Math.hypot(dx, dy) / radius;
		const height = Math.sqrt(Math.max(0, 1 - distance * distance));
		const normalLength = Math.hypot(dx / radius, dy / radius, height) || 1;
		const lightX = Math.cos(this.lightAngle);
		const lightY = Math.sin(this.lightAngle);
		const lightLength = Math.hypot(lightX, lightY, LIGHT_ELEVATION);
		const lambert = Math.max(
			0,
			((dx / radius) * lightX +
				(dy / radius) * lightY +
				height * LIGHT_ELEVATION) /
				(normalLength * lightLength)
		);
		return AMBIENT_LIGHT + DIRECT_LIGHT * lambert;
	}

	private render(): void {
		const { data } = this.image;
		for (let y = 0; y < this.grid; y++) {
			for (let x = 0; x < this.grid; x++) {
				const offset = (y * this.grid + x) * RGBA_CHANNELS;
				const dx = (x + PIXEL_CENTER) * this.scale - CENTER;
				const dy = (y + PIXEL_CENTER) * this.scale - CENTER;
				const radius = edgeRadius(Math.atan2(dy, dx));
				const threshold = bayerThreshold(x, y);
				const visible =
					Math.hypot(dx, dy) <= radius &&
					!insideBite(dx, dy, this.bite) &&
					threshold >= this.dissolve;
				if (!visible) {
					data[offset + ALPHA_CHANNEL] = 0;
					continue;
				}
				const light = Math.min(
					1,
					this.shade(dx, dy, radius) +
						(texture(x, y) - TEXTURE_MIDPOINT) * TEXTURE_STRENGTH
				);
				const chip = CHIPS.some(
					(candidate) =>
						Math.hypot(dx - candidate.x, dy - candidate.y) < candidate.radius
				);
				const scaled = light * (this.tones.length - 1);
				const base = Math.floor(scaled);
				const tone = chip
					? this.chipTone
					: (this.tones[
							Math.min(
								this.tones.length - 1,
								scaled - base > threshold ? base + 1 : base
							)
						] ?? this.chipTone);
				data.set(tone, offset);
				data[offset + ALPHA_CHANNEL] = OPAQUE;
			}
		}
		this.context.putImageData(this.image, 0, 0);
	}
}
