/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
	Color,
	type Group,
	type Material,
	MeshBasicMaterial,
	SRGBColorSpace,
} from 'three';
import { DITHER_STYLE } from '@/components/landing/visuals/dither-style';
import {
	createCoinMaterial,
	readCoinColors,
} from '@/components/landing/visuals/usdc-coin/usdc-coin-material';
import {
	type CoinFrameloop,
	cellPixelRatio,
	Warmup,
	WebglUnavailable,
} from '@/components/landing/visuals/usdc-coin/usdc-coin-scene';
import {
	CAMERA,
	FINISHES,
	KEYHOLE,
	MOTION,
	PADLOCK,
	STILL_FRAME_SECONDS,
} from './padlock-config';
import {
	createPadlockGeometry,
	disposePadlockGeometry,
	type PadlockGeometry,
} from './padlock-geometry';

const HALF_TURN = Math.PI;

function createPadlockMaterials() {
	const colors = readCoinColors();
	const [darkest] = colors.ramp;
	const keyhole = new Color();
	if (darkest) keyhole.setRGB(darkest.x, darkest.y, darkest.z, SRGBColorSpace);
	return {
		body: createCoinMaterial(FINISHES.body, colors),
		shackle: createCoinMaterial(FINISHES.shackle, colors),
		keyhole: new MeshBasicMaterial({ color: keyhole, toneMapped: false }),
	};
}

function pose(group: Group, seconds: number) {
	group.rotation.set(
		MOTION.tilt + Math.sin(seconds * MOTION.wobbleRate) * MOTION.wobbleAngle,
		MOTION.startAngle + seconds * MOTION.spinRate,
		MOTION.roll
	);
}

function Keyhole({
	geometry,
	material,
	side,
}: {
	geometry: PadlockGeometry;
	material: Material;
	side: 1 | -1;
}) {
	return (
		<group
			position={[0, 0, geometry.faceDepth * side]}
			rotation={[0, side > 0 ? 0 : HALF_TURN, 0]}
		>
			<mesh
				geometry={geometry.keyholeCircle}
				material={material}
				position={[0, KEYHOLE.circleOffset, 0]}
			/>
			<mesh
				geometry={geometry.keyholeStem}
				material={material}
				position={[0, KEYHOLE.stemOffset, 0]}
			/>
		</group>
	);
}

function Padlock({ animate }: { animate: boolean }) {
	const geometry = useMemo(() => createPadlockGeometry(), []);
	const materials = useMemo(() => createPadlockMaterials(), []);
	const group = useRef<Group>(null);
	const clock = useRef(STILL_FRAME_SECONDS);
	const viewport = useThree((state) => state.viewport);
	const scale = Math.min(viewport.width, viewport.height) / PADLOCK.heightUnits;
	useEffect(
		() => () => {
			disposePadlockGeometry(geometry);
			for (const material of Object.values(materials)) material.dispose();
		},
		[geometry, materials]
	);
	useFrame((_state, delta) => {
		clock.current = animate
			? clock.current + Math.min(delta, MOTION.maxFrameSeconds)
			: STILL_FRAME_SECONDS;
		if (group.current) pose(group.current, clock.current);
	});
	return (
		<group ref={group} position={[0, PADLOCK.offsetY * scale, 0]} scale={scale}>
			<mesh geometry={geometry.shackle} material={materials.shackle} />
			<mesh geometry={geometry.body} material={materials.body} />
			<Keyhole geometry={geometry} material={materials.keyhole} side={1} />
			<Keyhole geometry={geometry} material={materials.keyhole} side={-1} />
		</group>
	);
}

export function PadlockScene({
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
			orthographic
			camera={{
				position: [0, 0, CAMERA.distance],
				zoom: CAMERA.zoom,
				near: CAMERA.near,
				far: CAMERA.far,
			}}
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
			<Padlock animate={animate} />
			<Warmup onReady={onReady} />
		</Canvas>
	);
}
