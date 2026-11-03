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
	BoxGeometry,
	EdgesGeometry,
	type Group,
	MeshBasicMaterial,
	PlaneGeometry,
} from 'three';
import { createDitheredMaterial } from '@/components/landing/visuals/dithered-material';

const CHASSIS_WIDTH = 1.5;
const CHASSIS_HEIGHT = 2.3;
const CHASSIS_DEPTH = 1.1;
const FRONT_PANEL_OFFSET = CHASSIS_DEPTH / 2 + 0.006;
const DRIVE_BAY_POSITIONS = [0.72, 0.42, 0.12] as const;
const STATUS_LIGHT_POSITIONS = [-0.36, -0.12, 0.12, 0.36] as const;

function DitheredMachine() {
	const groupRef = useRef<Group>(null);
	const prefersReducedMotion = useRef(false);
	const elapsedRef = useRef(0);
	const viewport = useThree((state) => state.viewport);
	const scale = Math.min(viewport.width, viewport.height) / 4.6;
	const chassisGeometry = useMemo(
		() => new BoxGeometry(CHASSIS_WIDTH, CHASSIS_HEIGHT, CHASSIS_DEPTH),
		[]
	);
	const chassisEdges = useMemo(
		() => new EdgesGeometry(chassisGeometry),
		[chassisGeometry]
	);
	const driveBayGeometry = useMemo(() => new PlaneGeometry(1.08, 0.18), []);
	const statusLightGeometry = useMemo(() => new PlaneGeometry(0.12, 0.06), []);
	const chassisMaterial = useMemo(() => createDitheredMaterial(), []);
	const panelMaterial = useMemo(
		() => new MeshBasicMaterial({ color: '#17091f', toneMapped: false }),
		[]
	);
	const statusLightMaterial = useMemo(
		() => new MeshBasicMaterial({ color: '#ad5cf6', toneMapped: false }),
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
			chassisGeometry.dispose();
			chassisEdges.dispose();
			driveBayGeometry.dispose();
			statusLightGeometry.dispose();
			chassisMaterial.dispose();
			panelMaterial.dispose();
			statusLightMaterial.dispose();
		},
		[
			chassisEdges,
			chassisGeometry,
			chassisMaterial,
			driveBayGeometry,
			panelMaterial,
			statusLightGeometry,
			statusLightMaterial,
		]
	);

	useFrame((_state, delta) => {
		if (prefersReducedMotion.current) return;
		elapsedRef.current += delta;
		chassisMaterial.uniforms.u_time.value = elapsedRef.current;
		if (!groupRef.current) return;
		groupRef.current.rotation.y =
			-0.5 + Math.sin(elapsedRef.current * 0.32) * 0.42;
		groupRef.current.rotation.x =
			-0.14 + Math.sin(elapsedRef.current * 0.3) * 0.04;
	});

	return (
		<group ref={groupRef} rotation={[-0.14, -0.5, 0.03]} scale={scale}>
			<mesh geometry={chassisGeometry} material={chassisMaterial}>
				<lineSegments geometry={chassisEdges}>
					<lineBasicMaterial color="#ad5cf6" transparent opacity={0.58} />
				</lineSegments>
			</mesh>
			{DRIVE_BAY_POSITIONS.map((yPosition) => (
				<mesh
					key={yPosition}
					geometry={driveBayGeometry}
					material={panelMaterial}
					position={[0, yPosition, FRONT_PANEL_OFFSET]}
				/>
			))}
			{STATUS_LIGHT_POSITIONS.map((xPosition) => (
				<mesh
					key={xPosition}
					geometry={statusLightGeometry}
					material={statusLightMaterial}
					position={[xPosition, -0.78, FRONT_PANEL_OFFSET]}
				/>
			))}
		</group>
	);
}

export function HostMachine() {
	return (
		<div className="relative size-full" aria-hidden="true">
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
					className="origin-[200px_200px] animate-[snapflow-spin_22s_linear_infinite]"
					opacity=".7"
				/>
			</svg>
			<Canvas
				orthographic
				camera={{ position: [0, 0, 6], zoom: 90 }}
				dpr={[1, 1.35]}
				fallback={
					<div className="flex size-full items-center justify-center text-8xl text-snapflow-purple">
						▤
					</div>
				}
				gl={{
					alpha: true,
					antialias: false,
					powerPreference: 'high-performance',
				}}
				onCreated={({ gl }) => gl.setClearColor(0, 0)}
			>
				<DitheredMachine />
			</Canvas>
		</div>
	);
}
