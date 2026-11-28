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
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { loadGateState } from '@/lib/load-gate';
import { startShaderScene } from '../webgl/shader-scene';
import {
	CLEAR_ZONE,
	MACHINE_FIELD_PALETTE,
	STILL_FRAME_SECONDS,
} from './machine-field-config';
import { machineFieldFragmentShader } from './machine-field-shader';

const HALF = 0.5;
const CLEAR_ZONE_COMPONENTS = 4;

function measureClearZone(canvas: HTMLCanvasElement) {
	const target = canvas.closest('section')?.querySelector(CLEAR_ZONE.selector);
	const field = canvas.getBoundingClientRect();
	if (!target || field.width <= 0 || field.height <= 0) {
		return new Float32Array(CLEAR_ZONE_COMPONENTS);
	}
	const text = target.getBoundingClientRect();
	return new Float32Array([
		(text.left + text.width * HALF - field.left) / field.width,
		1 - (text.top + text.height * HALF - field.top) / field.height,
		((text.width * HALF) / field.width) * CLEAR_ZONE.padding,
		((text.height * HALF) / field.height) * CLEAR_ZONE.padding,
	]);
}

export function MachineField() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [webglUnavailable, setWebglUnavailable] = useState(false);
	const [drawn, setDrawn] = useState(false);
	const reducedMotion = usePrefersReducedMotion();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const scene = startShaderScene({
			canvas,
			fragmentShader: machineFieldFragmentShader,
			uniformNames: ['u_clear'],
			palette: MACHINE_FIELD_PALETTE,
			onResize: (_size, program) =>
				program.uniform4fv('u_clear', measureClearZone(canvas)),
			onFirstFrame: () => setDrawn(true),
			cellSize: DITHER_STYLE.cellSize,
			stillFrameSeconds: reducedMotion ? STILL_FRAME_SECONDS : null,
		});
		if (!scene) {
			setWebglUnavailable(true);
			return;
		}
		return scene.dispose;
	}, [reducedMotion]);

	return (
		<div
			className="pointer-events-none absolute inset-0 overflow-hidden bg-snapflow-ink"
			aria-hidden="true"
			data-load-gate={loadGateState(drawn || webglUnavailable)}
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
