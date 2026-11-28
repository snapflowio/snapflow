/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CanvasSize,
	createFullscreenProgram,
	type FullscreenProgram,
	observeCanvasSize,
	readCssColor,
} from './fullscreen-program';
import { observeVisibility } from './observe-visibility';

const MILLISECONDS_PER_SECOND = 1000;
const SCENE_UNIFORMS = ['u_resolution', 'u_time'] as const;

type SceneUniform = (typeof SCENE_UNIFORMS)[number];

export type PaletteEntry<PaletteName extends string> = readonly [
	uniform: PaletteName,
	customProperty: string,
];

export type ShaderSceneOptions<
	Name extends string,
	PaletteName extends string,
> = {
	canvas: HTMLCanvasElement;
	fragmentShader: string;
	uniformNames?: readonly Name[];
	palette: readonly PaletteEntry<PaletteName>[];
	cellSize: number;
	stillFrameSeconds: number | null;
	onResize?: (
		size: CanvasSize,
		program: FullscreenProgram<Name | PaletteName | SceneUniform>
	) => void;
	onFrame?: (
		seconds: number,
		program: FullscreenProgram<Name | PaletteName | SceneUniform>
	) => void;
	onFirstFrame?: () => void;
};

export function startShaderScene<
	Name extends string,
	PaletteName extends string,
>({
	canvas,
	fragmentShader,
	uniformNames = [],
	palette,
	cellSize,
	stillFrameSeconds,
	onResize,
	onFrame,
	onFirstFrame,
}: ShaderSceneOptions<Name, PaletteName>) {
	const colors = palette.map(
		([uniform, customProperty]) =>
			[uniform, readCssColor(customProperty)] as const
	);
	const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
	const program = gl
		? createFullscreenProgram<Name | PaletteName | SceneUniform>(
				gl,
				fragmentShader,
				[
					...SCENE_UNIFORMS,
					...uniformNames,
					...palette.map(([uniform]) => uniform),
				]
			)
		: null;
	if (!(gl && program) || colors.some(([, rgb]) => rgb === null)) {
		program?.dispose();
		return null;
	}

	for (const [uniform, rgb] of colors) {
		if (rgb) program.uniform3fv(uniform, rgb);
	}

	let drawn = false;
	const draw = (seconds: number) => {
		onFrame?.(seconds, program);
		program.uniform1f('u_time', seconds);
		program.draw();
		if (drawn) return;
		drawn = true;
		onFirstFrame?.();
	};

	const canvasSize = observeCanvasSize(canvas, cellSize, (size) => {
		gl.viewport(0, 0, size.width, size.height);
		program.uniform2f('u_resolution', size.width, size.height);
		onResize?.(size, program);
		if (stillFrameSeconds !== null) draw(stillFrameSeconds);
	});
	const visibility = observeVisibility(canvas.closest('section') ?? canvas);

	let frame = 0;
	if (stillFrameSeconds === null) {
		const loop = (timestamp: number) => {
			if (canvasSize.current() && (!drawn || visibility.current())) {
				draw(timestamp / MILLISECONDS_PER_SECOND);
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
	}

	return {
		redraw: () => {
			if (stillFrameSeconds !== null && canvasSize.current()) {
				draw(stillFrameSeconds);
			}
		},
		dispose: () => {
			cancelAnimationFrame(frame);
			canvasSize.dispose();
			visibility.dispose();
			program.dispose();
		},
	};
}
