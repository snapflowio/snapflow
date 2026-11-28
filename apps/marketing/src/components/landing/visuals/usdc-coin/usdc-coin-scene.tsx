/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { OrthographicCamera } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { BufferGeometry, Group, InstancedMesh, Material } from 'three';
import { DITHER_STYLE } from '@/components/landing/visuals/dither-style';
import {
	CAMERA,
	COIN,
	FINISHES,
	MINIMUM_CELL_DEVICE_PIXELS,
	MOTION,
	STILL_FRAME_SECONDS,
	WARMUP_FRAMES,
} from './usdc-coin-config';
import {
	type CoinGeometry,
	createCoinGeometry,
	disposeCoinGeometry,
} from './usdc-coin-geometry';
import { createCoinMaterial, readCoinColors } from './usdc-coin-material';

export type CoinFrameloop = 'always' | 'never' | 'demand';

export function cellPixelRatio(cellSize: number) {
	const devicePixels = Math.max(
		MINIMUM_CELL_DEVICE_PIXELS,
		Math.round(cellSize * window.devicePixelRatio)
	);
	return window.devicePixelRatio / devicePixels;
}

export function Warmup({ onReady }: { onReady: () => void }) {
	const gl = useThree((state) => state.gl);
	const scene = useThree((state) => state.scene);
	const camera = useThree((state) => state.camera);
	const warmup = useRef({ compiled: false, frames: 0, done: false });
	useEffect(() => {
		const state = warmup.current;
		const compiled = () => {
			state.compiled = true;
		};
		gl.compileAsync(scene, camera).then(compiled, compiled);
	}, [gl, scene, camera]);
	useFrame(() => {
		const state = warmup.current;
		if (state.done || !state.compiled) return;
		state.frames += 1;
		if (state.frames < WARMUP_FRAMES) return;
		state.done = true;
		onReady();
	});
	return null;
}

export function WebglUnavailable({ onReady }: { onReady: () => void }) {
	useEffect(onReady, [onReady]);
	return null;
}

function FittedCamera() {
	const size = useThree((state) => state.size);
	const zoom =
		(Math.min(size.width, size.height) * CAMERA.coinFraction) /
		(COIN.radius * COIN.scale * 2);
	return (
		<OrthographicCamera
			makeDefault
			position={[0, 0, CAMERA.distance]}
			zoom={zoom}
			near={CAMERA.near}
			far={CAMERA.far}
		/>
	);
}

function createCoinMaterials() {
	const colors = readCoinColors();
	return {
		field: createCoinMaterial(FINISHES.field, colors),
		rim: createCoinMaterial(FINISHES.rim, colors),
		edge: createCoinMaterial(FINISHES.edge, colors),
		emblem: createCoinMaterial(FINISHES.emblem, colors),
	};
}

function pose(group: Group, seconds: number) {
	group.rotation.set(
		MOTION.tilt + Math.sin(seconds * MOTION.wobbleRate) * MOTION.wobbleAngle,
		MOTION.startAngle + seconds * MOTION.spinRate,
		MOTION.roll
	);
}

function Parts({
	parts,
	material,
}: {
	parts: BufferGeometry[];
	material: Material;
}) {
	return parts.map((part) => (
		<mesh key={part.uuid} geometry={part} material={material} />
	));
}

function Reeding({
	reeding,
	material,
}: {
	reeding: CoinGeometry['reeding'];
	material: Material;
}) {
	const mesh = useRef<InstancedMesh>(null);
	useLayoutEffect(() => {
		if (!mesh.current) return;
		for (const [index, matrix] of reeding.matrices.entries()) {
			mesh.current.setMatrixAt(index, matrix);
		}
		mesh.current.instanceMatrix.needsUpdate = true;
	}, [reeding]);
	return (
		<instancedMesh
			ref={mesh}
			frustumCulled={false}
			args={[reeding.geometry, material, reeding.matrices.length]}
		/>
	);
}

function Coin({ animate }: { animate: boolean }) {
	const geometry = useMemo(() => createCoinGeometry(), []);
	const materials = useMemo(() => createCoinMaterials(), []);
	const group = useRef<Group>(null);
	const clock = useRef(STILL_FRAME_SECONDS);
	useEffect(
		() => () => {
			disposeCoinGeometry(geometry);
			for (const material of Object.values(materials)) material.dispose();
		},
		[geometry, materials]
	);
	useFrame((_state, delta) => {
		clock.current = animate
			? clock.current + Math.min(delta, MOTION.maxFrameSeconds)
			: STILL_FRAME_SECONDS;
		for (const material of Object.values(materials)) {
			material.uniforms.u_time.value = clock.current;
		}
		if (group.current) pose(group.current, clock.current);
	});
	return (
		<group ref={group} scale={COIN.scale}>
			<Parts parts={geometry.field} material={materials.field} />
			<Parts parts={geometry.rim} material={materials.rim} />
			<Parts parts={geometry.edge} material={materials.edge} />
			<Parts parts={geometry.emblem} material={materials.emblem} />
			<Reeding reeding={geometry.reeding} material={materials.edge} />
		</group>
	);
}

export function UsdcCoinScene({
	frameloop,
	animate,
	onReady,
}: {
	frameloop: CoinFrameloop;
	animate: boolean;
	onReady: () => void;
}) {
	return (
		<Canvas
			frameloop={frameloop}
			dpr={cellPixelRatio(DITHER_STYLE.cellSize)}
			className="[image-rendering:pixelated]"
			fallback={<WebglUnavailable onReady={onReady} />}
			gl={{
				alpha: true,
				antialias: false,
				powerPreference: 'high-performance',
			}}
			onCreated={({ gl }) => gl.setClearColor(0, 0)}
		>
			<FittedCamera />
			<Coin animate={animate} />
			<Warmup onReady={onReady} />
		</Canvas>
	);
}
