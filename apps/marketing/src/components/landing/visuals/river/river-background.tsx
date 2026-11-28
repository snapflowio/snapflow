/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { DITHER_STYLE } from '../dither-style';
import { startShaderScene } from '../webgl/shader-scene';
import { createRippleField, type Projection } from './ripple-field';
import {
	CLIFF_BASE_BELOW_HORIZON,
	RIPPLE,
	RIVER_PALETTE,
	SCENE,
} from './river-config';
import { riverFragmentShader, riverUniformNames } from './river-shader';

const MILLISECONDS_PER_SECOND = 1000;
const STILL_FRAME_SECONDS = 12;
const DEFAULT_HORIZON = 0.8;

function measureHorizon(canvas: HTMLCanvasElement, foot: Element | null) {
	if (!foot) return DEFAULT_HORIZON;
	const canvasBounds = canvas.getBoundingClientRect();
	const footBounds = foot.getBoundingClientRect();
	if (canvasBounds.height <= 0) return DEFAULT_HORIZON;
	const footCenter = footBounds.top + footBounds.height / 2;
	const footHeight = 1 - (footCenter - canvasBounds.top) / canvasBounds.height;
	return footHeight + CLIFF_BASE_BELOW_HORIZON;
}

type RiverBackgroundProps = {
	waterfallFootSelector: string;
};

export function RiverBackground({
	waterfallFootSelector,
}: RiverBackgroundProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [webglUnavailable, setWebglUnavailable] = useState(false);
	const reducedMotion = usePrefersReducedMotion();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const section = canvas.closest('section');
		const foot = section?.querySelector(waterfallFootSelector) ?? null;
		const ripples = createRippleField();
		const projection: Projection = { horizon: DEFAULT_HORIZON, aspect: 1 };
		let lastAmbientSeconds = 0;

		const scene = startShaderScene({
			canvas,
			fragmentShader: riverFragmentShader,
			uniformNames: riverUniformNames,
			palette: RIVER_PALETTE,
			cellSize: DITHER_STYLE.cellSize,
			stillFrameSeconds: reducedMotion ? STILL_FRAME_SECONDS : null,
			onResize: (size, program) => {
				projection.horizon = measureHorizon(canvas, foot);
				projection.aspect = Math.max(
					size.width / size.height,
					SCENE.minimumAspect
				);
				program.uniform1f('u_horizon', projection.horizon);
				program.uniform4fv('u_ripples', ripples.data);
			},
			onFrame: (seconds, program) => {
				if (
					!reducedMotion &&
					(seconds - lastAmbientSeconds) * MILLISECONDS_PER_SECOND >=
						RIPPLE.ambientIntervalMs
				) {
					lastAmbientSeconds = seconds;
					ripples.addAmbient(seconds);
				}
				program.uniform4fv('u_ripples', ripples.data);
			},
		});
		if (!scene) {
			setWebglUnavailable(true);
			return;
		}

		const onPointerDown = (event: PointerEvent) => {
			const bounds = canvas.getBoundingClientRect();
			ripples.addAtScreen(
				{
					x: (event.clientX - bounds.left) / bounds.width,
					y: 1 - (event.clientY - bounds.top) / bounds.height,
				},
				projection,
				performance.now() / MILLISECONDS_PER_SECOND,
				RIPPLE.clickStrength
			);
		};
		if (!reducedMotion) section?.addEventListener('pointerdown', onPointerDown);

		return () => {
			section?.removeEventListener('pointerdown', onPointerDown);
			scene.dispose();
		};
	}, [reducedMotion, waterfallFootSelector]);

	return (
		<div
			className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-snapflow-ink"
			aria-hidden="true"
		>
			{webglUnavailable ? null : (
				<canvas
					ref={canvasRef}
					className="absolute inset-0 size-full [image-rendering:pixelated]"
				/>
			)}
		</div>
	);
}
