/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useEffect, useRef, useState } from 'react';
import { DITHER_STYLE } from '@/components/landing/visuals/dither-style';
import { GLOBE_LAND_MASK } from '@/data/globe-land-mask';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
	createFullscreenProgram,
	readCssColor,
} from '../webgl/fullscreen-program';
import { observeVisibility } from '../webgl/observe-visibility';
import { GLOBE_HORIZON_PALETTE, PLANET } from './globe-horizon-config';
import {
	globeHorizonFragmentShader,
	globeHorizonUniformNames,
} from './globe-horizon-shader';

const MILLISECONDS_PER_SECOND = 1000;
const MAX_FRAME_SECONDS = 0.1;
const LAND_VALUE = 255;
const BITS_PER_BYTE = 8;
const RADIANS_PER_DEGREE = Math.PI / 180;
const QUARTER_TURN_DEGREES = 90;
const START_ROTATION =
	-(PLANET.facingLongitude + QUARTER_TURN_DEGREES) * RADIANS_PER_DEGREE;

function decodeLandMask() {
	const packed = Uint8Array.from(atob(GLOBE_LAND_MASK.bits), (character) =>
		character.charCodeAt(0)
	);
	const mask = new Uint8Array(GLOBE_LAND_MASK.width * GLOBE_LAND_MASK.height);
	for (let index = 0; index < mask.length; index += 1) {
		const byte = packed[Math.floor(index / BITS_PER_BYTE)] ?? 0;
		if (byte & (1 << (index % BITS_PER_BYTE))) mask[index] = LAND_VALUE;
	}
	return mask;
}

function uploadLandMask(gl: WebGLRenderingContext) {
	const texture = gl.createTexture();
	if (!texture) return null;
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.LUMINANCE,
		GLOBE_LAND_MASK.width,
		GLOBE_LAND_MASK.height,
		0,
		gl.LUMINANCE,
		gl.UNSIGNED_BYTE,
		decodeLandMask()
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	return texture;
}

function startGlobe(
	frame: HTMLDivElement,
	canvas: HTMLCanvasElement,
	reducedMotion: boolean
) {
	const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
	if (!gl) return null;
	const colors = GLOBE_HORIZON_PALETTE.map(
		([uniform, token]) => [uniform, readCssColor(token)] as const
	);
	const program = createFullscreenProgram(gl, globeHorizonFragmentShader, [
		'u_resolution',
		'u_time',
		...globeHorizonUniformNames,
		...GLOBE_HORIZON_PALETTE.map(([uniform]) => uniform),
	]);
	const texture = program ? uploadLandMask(gl) : null;
	if (!(program && texture) || colors.some(([, rgb]) => rgb === null)) {
		program?.dispose();
		gl.deleteTexture(texture);
		return null;
	}
	for (const [uniform, rgb] of colors) {
		if (rgb) program.uniform3fv(uniform, rgb);
	}

	let elapsed = PLANET.stillFrameSeconds;
	let hasSize = false;
	const draw = () => {
		program.uniform1f('u_time', elapsed);
		program.uniform1f(
			'u_rotation',
			START_ROTATION + elapsed * PLANET.rotationSpeed
		);
		program.draw();
	};

	const measure = () => {
		const bounds = frame.getBoundingClientRect();
		hasSize = bounds.width > 0 && bounds.height > 0;
		if (!hasSize) return;
		const pixelRatio = window.devicePixelRatio || 1;
		const cellDevicePixels = Math.max(
			1,
			Math.round(DITHER_STYLE.cellSize * pixelRatio)
		);
		const cellCssPixels = cellDevicePixels / pixelRatio;
		const width = Math.ceil(bounds.width / cellCssPixels);
		const height = Math.ceil(bounds.height / cellCssPixels);
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}
		canvas.style.width = `${width * cellCssPixels}px`;
		canvas.style.height = `${height * cellCssPixels}px`;
		const radiusOfWidth =
			window.innerWidth < PLANET.narrowBreakpoint
				? PLANET.narrowRadiusOfWidth
				: PLANET.wideRadiusOfWidth;
		gl.viewport(0, 0, width, height);
		program.uniform2f('u_resolution', width, height);
		program.uniform1f(
			'u_radius',
			(bounds.width / cellCssPixels) * radiusOfWidth
		);
		draw();
	};
	const resizeObserver = new ResizeObserver(measure);
	resizeObserver.observe(frame);
	measure();

	const visibility = observeVisibility(frame);
	let animationFrame = 0;
	let previous: number | null = null;
	if (!reducedMotion) {
		const loop = (timestamp: number) => {
			const seconds = timestamp / MILLISECONDS_PER_SECOND;
			if (visibility.current() && hasSize) {
				if (previous !== null) {
					elapsed += Math.min(seconds - previous, MAX_FRAME_SECONDS);
				}
				previous = seconds;
				draw();
			} else {
				previous = null;
			}
			animationFrame = requestAnimationFrame(loop);
		};
		animationFrame = requestAnimationFrame(loop);
	}

	return () => {
		cancelAnimationFrame(animationFrame);
		resizeObserver.disconnect();
		visibility.dispose();
		gl.deleteTexture(texture);
		program.dispose();
	};
}

export function GlobeHorizon() {
	const frameRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [webglUnavailable, setWebglUnavailable] = useState(false);
	const reducedMotion = usePrefersReducedMotion();

	useEffect(() => {
		const frame = frameRef.current;
		const canvas = canvasRef.current;
		if (!(frame && canvas)) return;
		const dispose = startGlobe(frame, canvas, reducedMotion);
		if (!dispose) {
			setWebglUnavailable(true);
			return;
		}
		return dispose;
	}, [reducedMotion]);

	return (
		<div
			ref={frameRef}
			className="pointer-events-none absolute inset-0 overflow-hidden bg-snapflow-ink"
			aria-hidden="true"
		>
			{webglUnavailable ? null : (
				<canvas
					ref={canvasRef}
					className="absolute bottom-0 left-0 [image-rendering:pixelated]"
				/>
			)}
		</div>
	);
}
