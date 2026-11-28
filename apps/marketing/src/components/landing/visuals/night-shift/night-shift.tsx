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
import { startShaderScene } from '../webgl/shader-scene';
import {
	EASING,
	FRAME,
	NIGHT_SHIFT_PALETTE,
	NIGHT_SHIFT_STEPS,
	type NightShiftState,
	type NightShiftStep,
	SCHEDULE,
	STILL_FRAME_SECONDS,
} from './night-shift-config';
import {
	nightShiftFragmentShader,
	nightShiftUniformNames,
} from './night-shift-shader';

const HALF = 0.5;
const STATE_KEYS = ['power', 'rows', 'screen', 'link', 'work'] as const;
const FULL_FRAME = new Float32Array([HALF, HALF, HALF, HALF]);

function measureFrame(canvas: HTMLCanvasElement) {
	const scene = canvas.getBoundingClientRect();
	const frame = canvas
		.closest(FRAME.sceneSelector)
		?.querySelector(FRAME.frameSelector)
		?.getBoundingClientRect();
	if (!frame || scene.width <= 0 || scene.height <= 0) return FULL_FRAME;
	return new Float32Array([
		(frame.left + frame.width * HALF - scene.left) / scene.width,
		1 - (frame.top + frame.height * HALF - scene.top) / scene.height,
		(frame.width * HALF) / scene.width,
		(frame.height * HALF) / scene.height,
	]);
}

function targetState(step: NightShiftStep, elapsed: number): NightShiftState {
	const { from, to } = NIGHT_SHIFT_STEPS[step];
	if (step === 'connect' && from && elapsed < EASING.bootDelaySeconds) {
		return from;
	}
	if (step === 'control') {
		const cycle = elapsed % (SCHEDULE.workSeconds + SCHEDULE.sleepSeconds);
		return cycle < SCHEDULE.workSeconds ? to : SCHEDULE.asleep;
	}
	return to;
}

type NightShiftProps = {
	step: NightShiftStep;
};

export function NightShift({ step }: NightShiftProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const stepRef = useRef(step);
	const stepStartRef = useRef<number | null>(null);
	const redrawRef = useRef<(() => void) | null>(null);
	const [webglUnavailable, setWebglUnavailable] = useState(false);
	const reducedMotion = usePrefersReducedMotion();

	useEffect(() => {
		stepRef.current = step;
		stepStartRef.current = null;
		redrawRef.current?.();
	}, [step]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const state: NightShiftState = {
			...NIGHT_SHIFT_STEPS[stepRef.current].to,
		};
		let lastSeconds: number | null = null;

		const advance = (seconds: number) => {
			const current = stepRef.current;
			const { from, to } = NIGHT_SHIFT_STEPS[current];
			if (reducedMotion) {
				Object.assign(state, to);
				return;
			}
			if (stepStartRef.current === null) {
				stepStartRef.current = seconds;
				if (from) Object.assign(state, from);
			}
			const target = targetState(current, seconds - stepStartRef.current);
			const frameSeconds = Math.min(
				Math.max(seconds - (lastSeconds ?? seconds), 0),
				EASING.maxFrameSeconds
			);
			lastSeconds = seconds;
			const blend = 1 - Math.exp(-frameSeconds * EASING.ratePerSecond);
			for (const key of STATE_KEYS) {
				state[key] += (target[key] - state[key]) * blend;
			}
		};

		const scene = startShaderScene({
			canvas,
			fragmentShader: nightShiftFragmentShader,
			uniformNames: nightShiftUniformNames,
			palette: NIGHT_SHIFT_PALETTE,
			cellSize: DITHER_STYLE.cellSize,
			stillFrameSeconds: reducedMotion ? STILL_FRAME_SECONDS : null,
			onResize: (_size, program) =>
				program.uniform4fv('u_frame', measureFrame(canvas)),
			onFrame: (seconds, program) => {
				advance(seconds);
				program.uniform1f('u_power', state.power);
				program.uniform1f('u_rows', state.rows);
				program.uniform1f('u_screen', state.screen);
				program.uniform1f('u_link', state.link);
				program.uniform1f('u_work', state.work);
			},
		});
		if (!scene) {
			setWebglUnavailable(true);
			return;
		}
		redrawRef.current = scene.redraw;
		return () => {
			redrawRef.current = null;
			scene.dispose();
		};
	}, [reducedMotion]);

	return (
		<div
			className="pointer-events-none absolute inset-0 overflow-hidden bg-snapflow-ink"
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
