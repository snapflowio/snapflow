/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
	BufferGeometry,
	CircleGeometry,
	Float32BufferAttribute,
	type Group,
	type InstancedMesh,
	LineBasicMaterial,
	MeshBasicMaterial,
	Object3D,
	SphereGeometry,
	Vector3,
} from 'three';
import { createDitheredMaterial } from '@/components/landing/visuals/dithered-material';
import { GLOBE_LAND_POINTS } from '@/data/globe-land-points';

const GLOBE_RADIUS = 1.45;
const SURFACE_RADIUS = GLOBE_RADIUS + 0.018;

function pointFromCoordinates(
	latitude: number,
	longitude: number,
	radius: number
) {
	const phi = ((90 - latitude) * Math.PI) / 180;
	const theta = ((longitude + 180) * Math.PI) / 180;

	return new Vector3(
		-radius * Math.sin(phi) * Math.cos(theta),
		radius * Math.cos(phi),
		radius * Math.sin(phi) * Math.sin(theta)
	);
}

function createGraticuleGeometry() {
	const positions: number[] = [];
	const segments = 72;
	const radius = GLOBE_RADIUS + 0.01;

	for (const latitude of [-60, -40, -20, 0, 20, 40, 60]) {
		for (let segment = 0; segment < segments; segment += 1) {
			const start = pointFromCoordinates(
				latitude,
				-180 + (segment / segments) * 360,
				radius
			);
			const end = pointFromCoordinates(
				latitude,
				-180 + ((segment + 1) / segments) * 360,
				radius
			);
			positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
		}
	}

	for (let longitude = -150; longitude < 180; longitude += 30) {
		for (let segment = 0; segment < segments; segment += 1) {
			const start = pointFromCoordinates(
				-90 + (segment / segments) * 180,
				longitude,
				radius
			);
			const end = pointFromCoordinates(
				-90 + ((segment + 1) / segments) * 180,
				longitude,
				radius
			);
			positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
		}
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	return geometry;
}

function EdgeNetworkGlobe() {
	const earthRef = useRef<Group>(null);
	const landMeshRef = useRef<InstancedMesh>(null);
	const prefersReducedMotion = useRef(false);
	const elapsedRef = useRef(0);
	const viewport = useThree((state) => state.viewport);
	const scale = Math.min(viewport.width, viewport.height) / 4.45;
	const globeGeometry = useMemo(
		() => new SphereGeometry(GLOBE_RADIUS, 64, 40),
		[]
	);
	const landGeometry = useMemo(() => new CircleGeometry(0.026, 5), []);
	const graticuleGeometry = useMemo(() => createGraticuleGeometry(), []);
	const globeMaterial = useMemo(
		() => createDitheredMaterial({ densityOffset: -0.28 }),
		[]
	);
	const landMaterial = useMemo(
		() =>
			new MeshBasicMaterial({
				color: '#f3eaff',
				depthWrite: false,
				opacity: 0.92,
				transparent: true,
				toneMapped: false,
			}),
		[]
	);
	const graticuleMaterial = useMemo(
		() =>
			new LineBasicMaterial({
				color: '#ad5cf6',
				depthWrite: false,
				opacity: 0.22,
				transparent: true,
				toneMapped: false,
			}),
		[]
	);
	useLayoutEffect(() => {
		const mesh = landMeshRef.current;
		if (!mesh) return;

		const landDot = new Object3D();
		const target = new Vector3();
		const count = GLOBE_LAND_POINTS.length / 2;

		for (let index = 0; index < count; index += 1) {
			const latitude = GLOBE_LAND_POINTS[index * 2] ?? 0;
			const longitude = GLOBE_LAND_POINTS[index * 2 + 1] ?? 0;
			const position = pointFromCoordinates(
				latitude,
				longitude,
				SURFACE_RADIUS
			);

			landDot.position.copy(position);
			target.copy(position).multiplyScalar(2);
			landDot.lookAt(target);
			landDot.scale.setScalar(index % 31 === 0 ? 1.22 : 1);
			landDot.updateMatrix();
			mesh.setMatrixAt(index, landDot.matrix);
		}

		mesh.instanceMatrix.needsUpdate = true;
	}, []);

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
			globeGeometry.dispose();
			landGeometry.dispose();
			graticuleGeometry.dispose();
			globeMaterial.dispose();
			landMaterial.dispose();
			graticuleMaterial.dispose();
		},
		[
			globeGeometry,
			globeMaterial,
			graticuleGeometry,
			graticuleMaterial,
			landGeometry,
			landMaterial,
		]
	);

	useFrame((_state, delta) => {
		if (!prefersReducedMotion.current) elapsedRef.current += delta;
		const elapsed = elapsedRef.current;
		globeMaterial.uniforms.u_time.value = elapsed;

		if (earthRef.current && !prefersReducedMotion.current) {
			earthRef.current.rotation.y = -0.48 + elapsed * 0.34;
			earthRef.current.rotation.x = -0.12 + Math.sin(elapsed * 0.13) * 0.025;
		}
	});

	return (
		<group position={[0, 0.02, 0]} scale={scale}>
			<group ref={earthRef} rotation={[-0.12, -0.48, -0.04]}>
				<mesh geometry={globeGeometry} material={globeMaterial} />
				<lineSegments
					geometry={graticuleGeometry}
					material={graticuleMaterial}
				/>
				<instancedMesh
					ref={landMeshRef}
					args={[landGeometry, landMaterial, GLOBE_LAND_POINTS.length / 2]}
					frustumCulled={false}
				/>
			</group>
		</group>
	);
}

export function PlacementGraphic() {
	return (
		<div className="relative size-full" aria-hidden="true">
			<div className="pointer-events-none absolute inset-[13%] rounded-full bg-snapflow-purple/8 blur-3xl" />
			<svg
				className="pointer-events-none absolute inset-0 size-full"
				viewBox="0 0 400 400"
			>
				<g fill="none" stroke="var(--snapflow-purple)" opacity=".2">
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
					className="origin-[200px_200px] animate-[snapflow-spin_30s_linear_infinite] motion-reduce:animate-none"
					opacity=".7"
				/>
			</svg>
			<Canvas
				orthographic
				camera={{ position: [0, 0, 7], zoom: 90 }}
				dpr={[1, 1.35]}
				fallback={<div className="size-full opacity-0" />}
				gl={{
					alpha: true,
					antialias: false,
					powerPreference: 'high-performance',
				}}
				onCreated={({ gl }) => gl.setClearColor(0, 0)}
			>
				<EdgeNetworkGlobe />
			</Canvas>
		</div>
	);
}
