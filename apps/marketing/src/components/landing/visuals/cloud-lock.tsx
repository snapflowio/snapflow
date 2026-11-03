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
	CatmullRomCurve3,
	CircleGeometry,
	EdgesGeometry,
	ExtrudeGeometry,
	type Group,
	MeshBasicMaterial,
	PlaneGeometry,
	Shape,
	TubeGeometry,
	Vector3,
} from 'three';
import { createDitheredMaterial } from '@/components/landing/visuals/dithered-material';

function createLockBody() {
	const halfWidth = 1.12;
	const halfHeight = 0.82;
	const radius = 0.16;
	const shape = new Shape();
	shape.moveTo(-halfWidth + radius, -halfHeight);
	shape.lineTo(halfWidth - radius, -halfHeight);
	shape.quadraticCurveTo(
		halfWidth,
		-halfHeight,
		halfWidth,
		-halfHeight + radius
	);
	shape.lineTo(halfWidth, halfHeight - radius);
	shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
	shape.lineTo(-halfWidth + radius, halfHeight);
	shape.quadraticCurveTo(
		-halfWidth,
		halfHeight,
		-halfWidth,
		halfHeight - radius
	);
	shape.lineTo(-halfWidth, -halfHeight + radius);
	shape.quadraticCurveTo(
		-halfWidth,
		-halfHeight,
		-halfWidth + radius,
		-halfHeight
	);

	const geometry = new ExtrudeGeometry(shape, {
		bevelEnabled: true,
		bevelSegments: 3,
		bevelSize: 0.05,
		bevelThickness: 0.045,
		curveSegments: 12,
		depth: 0.42,
		steps: 1,
	});
	geometry.center();
	return geometry;
}

function Keyhole({
	material,
	position,
	rotation,
	circleGeometry,
	stemGeometry,
}: {
	material: MeshBasicMaterial;
	position: [number, number, number];
	rotation?: [number, number, number];
	circleGeometry: CircleGeometry;
	stemGeometry: PlaneGeometry;
}) {
	return (
		<group position={position} rotation={rotation}>
			<mesh
				geometry={circleGeometry}
				material={material}
				position={[0, 0.11, 0]}
			/>
			<mesh
				geometry={stemGeometry}
				material={material}
				position={[0, -0.14, 0]}
			/>
		</group>
	);
}

function DitheredLock() {
	const groupRef = useRef<Group>(null);
	const prefersReducedMotion = useRef(false);
	const elapsedRef = useRef(0);
	const viewport = useThree((state) => state.viewport);
	const scale = Math.min(viewport.width, viewport.height) / 4.7;
	const bodyGeometry = useMemo(() => createLockBody(), []);
	const bodyEdges = useMemo(
		() => new EdgesGeometry(bodyGeometry, 22),
		[bodyGeometry]
	);
	const shackleCurve = useMemo(
		() =>
			new CatmullRomCurve3(
				[
					new Vector3(-0.66, 0.55, 0),
					new Vector3(-0.66, 1.3, 0),
					new Vector3(-0.42, 1.63, 0),
					new Vector3(0, 1.75, 0),
					new Vector3(0.42, 1.63, 0),
					new Vector3(0.66, 1.3, 0),
					new Vector3(0.66, 0.55, 0),
				],
				false,
				'centripetal'
			),
		[]
	);
	const shackleGeometry = useMemo(
		() => new TubeGeometry(shackleCurve, 64, 0.145, 10, false),
		[shackleCurve]
	);
	const circleGeometry = useMemo(() => new CircleGeometry(0.18, 32), []);
	const stemGeometry = useMemo(() => new PlaneGeometry(0.17, 0.38), []);
	const material = useMemo(() => createDitheredMaterial(), []);
	const keyholeMaterial = useMemo(
		() => new MeshBasicMaterial({ color: '#17091f', toneMapped: false }),
		[]
	);

	useEffect(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updatePreference = () => {
			prefersReducedMotion.current = media.matches;
		};
		updatePreference();
		media.addEventListener('change', updatePreference);
		return () => media.removeEventListener('change', updatePreference);
	}, []);

	useEffect(
		() => () => {
			bodyGeometry.dispose();
			bodyEdges.dispose();
			shackleGeometry.dispose();
			circleGeometry.dispose();
			stemGeometry.dispose();
			material.dispose();
			keyholeMaterial.dispose();
		},
		[
			bodyEdges,
			bodyGeometry,
			circleGeometry,
			keyholeMaterial,
			material,
			shackleGeometry,
			stemGeometry,
		]
	);

	useFrame((_state, delta) => {
		if (prefersReducedMotion.current) return;
		elapsedRef.current += delta;
		material.uniforms.u_time.value = elapsedRef.current;
		if (!groupRef.current) return;
		groupRef.current.rotation.y = 0.45 + elapsedRef.current * 0.31;
		groupRef.current.rotation.x =
			-0.08 + Math.sin(elapsedRef.current * 0.3) * 0.045;
	});

	return (
		<group
			ref={groupRef}
			position={[0, -0.38, 0]}
			rotation={[-0.08, 0.45, -0.035]}
			scale={scale}
		>
			<mesh geometry={shackleGeometry} material={material} />
			<mesh geometry={bodyGeometry} material={material}>
				<lineSegments geometry={bodyEdges}>
					<lineBasicMaterial color="#f0ede6" transparent opacity={0.3} />
				</lineSegments>
			</mesh>
			<Keyhole
				material={keyholeMaterial}
				circleGeometry={circleGeometry}
				stemGeometry={stemGeometry}
				position={[0, 0, 0.258]}
			/>
			<Keyhole
				material={keyholeMaterial}
				circleGeometry={circleGeometry}
				stemGeometry={stemGeometry}
				position={[0, 0, -0.258]}
				rotation={[0, Math.PI, 0]}
			/>
		</group>
	);
}

export function CloudLock() {
	return (
		<div className="relative size-full" aria-hidden="true">
			<svg
				className="pointer-events-none absolute inset-0 size-full"
				viewBox="0 0 400 400"
			>
				<g fill="none" stroke="var(--snapflow-paper)" opacity=".16">
					<circle cx="200" cy="200" r="170" strokeWidth=".5" />
					<circle
						cx="200"
						cy="200"
						r="135"
						strokeDasharray="2 9"
						strokeWidth=".7"
					/>
					<path
						d="M200 12v42M200 346v42M12 200h42M346 200h42"
						strokeWidth=".6"
					/>
				</g>
				<circle
					cx="200"
					cy="200"
					r="170"
					fill="none"
					stroke="var(--snapflow-purple)"
					strokeDasharray="35 220"
					strokeWidth="1"
					className="origin-[200px_200px] animate-[snapflow-spin-reverse_26s_linear_infinite]"
					opacity=".7"
				/>
			</svg>
			<Canvas
				orthographic
				camera={{ position: [0, 0, 6], zoom: 90 }}
				dpr={[1, 1.35]}
				fallback={
					<div className="flex size-full items-center justify-center text-7xl text-snapflow-purple">
						×
					</div>
				}
				gl={{
					alpha: true,
					antialias: false,
					powerPreference: 'high-performance',
				}}
				onCreated={({ gl }) => gl.setClearColor(0, 0)}
			>
				<DitheredLock />
			</Canvas>
		</div>
	);
}
