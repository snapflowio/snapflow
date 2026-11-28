/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BoxGeometry,
	type BufferGeometry,
	CapsuleGeometry,
	CatmullRomCurve3,
	LatheGeometry,
	Matrix4,
	Path,
	SphereGeometry,
	TorusGeometry,
	TubeGeometry,
	Vector2,
	Vector3,
} from 'three';
import { BEADS, COIN, DOLLAR, REEDING } from './usdc-coin-config';

const FULL_TURN = Math.PI * 2;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;

function band(from: Vector2, to: Vector2) {
	return new LatheGeometry([from, to], COIN.segments).rotateX(QUARTER_TURN);
}

function bothFaces(create: () => BufferGeometry[]) {
	return [...create(), ...create().map((part) => part.rotateY(HALF_TURN))];
}

function profile() {
	const { radius, fieldRadius, rimBevel, rimHeight, fieldHeight, chamfer } =
		COIN;
	const rimStart = fieldRadius + rimBevel;
	return {
		bottomField: [
			new Vector2(0, -fieldHeight),
			new Vector2(fieldRadius, -fieldHeight),
		],
		bottomRim: [
			new Vector2(fieldRadius, -fieldHeight),
			new Vector2(rimStart, -rimHeight),
			new Vector2(radius - chamfer, -rimHeight),
			new Vector2(radius, chamfer - rimHeight),
		],
		edge: [
			new Vector2(radius, chamfer - rimHeight),
			new Vector2(radius, rimHeight - chamfer),
		],
		topRim: [
			new Vector2(radius, rimHeight - chamfer),
			new Vector2(radius - chamfer, rimHeight),
			new Vector2(rimStart, rimHeight),
			new Vector2(fieldRadius, fieldHeight),
		],
		topField: [
			new Vector2(fieldRadius, fieldHeight),
			new Vector2(0, fieldHeight),
		],
	};
}

function bands(points: Vector2[]) {
	return points.slice(1).map((point, index) => band(points[index], point));
}

function reeding() {
	const height = (COIN.rimHeight - COIN.chamfer) * 2 * REEDING.heightFraction;
	const width =
		((FULL_TURN * COIN.radius) / REEDING.count) * REEDING.widthFraction;
	return {
		geometry: new BoxGeometry(REEDING.depth * 2, width, height).translate(
			COIN.radius,
			0,
			0
		),
		matrices: Array.from({ length: REEDING.count }, (_, index) =>
			new Matrix4().makeRotationZ((index / REEDING.count) * FULL_TURN)
		),
	};
}

function beadRing() {
	return [
		new TorusGeometry(
			BEADS.radius,
			BEADS.ringRadius,
			BEADS.tubeSegments,
			BEADS.ringSegments
		).translate(0, 0, COIN.fieldHeight),
	];
}

function dollarStroke() {
	const { bowlRadius, terminalAngle } = DOLLAR;
	const path = new Path();
	path.absarc(
		0,
		bowlRadius,
		bowlRadius,
		terminalAngle,
		HALF_TURN + QUARTER_TURN,
		false
	);
	path.absarc(
		0,
		-bowlRadius,
		bowlRadius,
		QUARTER_TURN,
		HALF_TURN + terminalAngle,
		true
	);
	const points = path
		.getSpacedPoints(DOLLAR.pathPoints)
		.map((point) => new Vector3(point.x, point.y, 0));
	const curve = new CatmullRomCurve3(points);
	const ends = [points[0], points[points.length - 1]].map((point) =>
		new SphereGeometry(
			DOLLAR.strokeRadius,
			DOLLAR.radialSegments,
			DOLLAR.radialSegments
		).translate(point.x, point.y, point.z)
	);
	return [
		new TubeGeometry(
			curve,
			DOLLAR.tubeSegments,
			DOLLAR.strokeRadius,
			DOLLAR.radialSegments,
			false
		),
		...ends,
	];
}

function dollarTicks() {
	const reach = DOLLAR.bowlRadius * 2 + DOLLAR.tickGap + DOLLAR.tickLength / 2;
	return [reach, -reach].map((y) =>
		new CapsuleGeometry(
			DOLLAR.strokeRadius,
			DOLLAR.tickLength,
			DOLLAR.capSegments,
			DOLLAR.radialSegments
		).translate(0, y, 0)
	);
}

function dollar() {
	return [...dollarStroke(), ...dollarTicks()].map((part) =>
		part.translate(0, 0, COIN.fieldHeight)
	);
}

export function createCoinGeometry() {
	const shape = profile();
	return {
		field: [...bands(shape.bottomField), ...bands(shape.topField)],
		rim: [
			...bands(shape.bottomRim),
			...bands(shape.topRim),
			...bothFaces(beadRing),
		],
		edge: bands(shape.edge),
		emblem: bothFaces(dollar),
		reeding: reeding(),
	};
}

export type CoinGeometry = ReturnType<typeof createCoinGeometry>;

export function disposeCoinGeometry(geometry: CoinGeometry) {
	const { field, rim, edge, emblem, reeding: ridges } = geometry;
	for (const part of [...field, ...rim, ...edge, ...emblem]) part.dispose();
	ridges.geometry.dispose();
}
