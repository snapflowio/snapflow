/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { FULLSCREEN_VERTEX_SHADER } from './glsl-chunks';

const FULLSCREEN_QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const QUAD_VERTEX_COUNT = 4;
const POSITION_COMPONENTS = 2;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const COLOR_CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const RED_CHANNEL = [1, 3] as const;
const GREEN_CHANNEL = [3, 5] as const;
const BLUE_CHANNEL = [5, 7] as const;

export type RgbColor = readonly [number, number, number];

export type FullscreenProgram<Name extends string> = {
	uniform1f: (name: Name, value: number) => void;
	uniform2f: (name: Name, x: number, y: number) => void;
	uniform3fv: (name: Name, value: RgbColor) => void;
	uniform4fv: (name: Name, value: Float32Array) => void;
	draw: () => void;
	dispose: () => void;
};

export type CanvasSize = {
	width: number;
	height: number;
};

function compileShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string
) {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
	gl.deleteShader(shader);
	return null;
}

export function createFullscreenProgram<Name extends string>(
	gl: WebGLRenderingContext,
	fragmentSource: string,
	uniformNames: readonly Name[]
): FullscreenProgram<Name> | null {
	const vertex = compileShader(gl, gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SHADER);
	const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	const program = gl.createProgram();
	const release = () => {
		gl.deleteProgram(program);
		gl.deleteShader(vertex);
		gl.deleteShader(fragment);
	};
	if (!(vertex && fragment && program)) {
		release();
		return null;
	}
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	const buffer = gl.getProgramParameter(program, gl.LINK_STATUS)
		? gl.createBuffer()
		: null;
	if (!buffer) {
		release();
		return null;
	}
	gl.useProgram(program);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);
	const position = gl.getAttribLocation(program, 'a_position');
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, POSITION_COMPONENTS, gl.FLOAT, false, 0, 0);
	const uniforms = new Map(
		uniformNames.map((name) => [name, gl.getUniformLocation(program, name)])
	);
	const location = (name: Name) => uniforms.get(name) ?? null;
	return {
		uniform1f: (name, value) => gl.uniform1f(location(name), value),
		uniform2f: (name, x, y) => gl.uniform2f(location(name), x, y),
		uniform3fv: (name, value) => gl.uniform3fv(location(name), value),
		uniform4fv: (name, value) => gl.uniform4fv(location(name), value),
		draw: () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, QUAD_VERTEX_COUNT),
		dispose: () => {
			gl.deleteBuffer(buffer);
			release();
		},
	};
}

export function observeCanvasSize(
	canvas: HTMLCanvasElement,
	cellSize: number,
	onResize?: (size: CanvasSize) => void
) {
	let size: CanvasSize | null = null;
	const measure = () => {
		const bounds = canvas.getBoundingClientRect();
		if (bounds.width <= 0 || bounds.height <= 0) {
			size = null;
			return;
		}
		const width = Math.ceil(bounds.width / cellSize);
		const height = Math.ceil(bounds.height / cellSize);
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}
		size = { width, height };
		onResize?.(size);
	};
	const observer = new ResizeObserver(measure);
	observer.observe(canvas);
	measure();
	return {
		current: () => size,
		dispose: () => observer.disconnect(),
	};
}

function readChannel(hex: string, [start, end]: readonly [number, number]) {
	return Number.parseInt(hex.slice(start, end), HEX_RADIX) / COLOR_CHANNEL_MAX;
}

export function parseHexColor(value: string): RgbColor | null {
	const hex = value.trim();
	if (!HEX_COLOR_PATTERN.test(hex)) return null;
	return [
		readChannel(hex, RED_CHANNEL),
		readChannel(hex, GREEN_CHANNEL),
		readChannel(hex, BLUE_CHANNEL),
	];
}

export function readCssColor(customProperty: string) {
	return parseHexColor(
		getComputedStyle(document.documentElement).getPropertyValue(customProperty)
	);
}
