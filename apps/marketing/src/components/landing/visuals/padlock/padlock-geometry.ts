/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	CatmullRomCurve3,
	CircleGeometry,
	ExtrudeGeometry,
	PlaneGeometry,
	Shape,
	TubeGeometry,
	Vector3,
} from 'three';
import { BODY, KEYHOLE, SHACKLE } from './padlock-config';

const SHACKLE_CURVE = 'centripetal';

function bodyShape() {
	const { halfWidth, halfHeight, cornerRadius } = BODY;
	const shape = new Shape();
	shape.moveTo(-halfWidth + cornerRadius, -halfHeight);
	shape.lineTo(halfWidth - cornerRadius, -halfHeight);
	shape.quadraticCurveTo(
		halfWidth,
		-halfHeight,
		halfWidth,
		-halfHeight + cornerRadius
	);
	shape.lineTo(halfWidth, halfHeight - cornerRadius);
	shape.quadraticCurveTo(
		halfWidth,
		halfHeight,
		halfWidth - cornerRadius,
		halfHeight
	);
	shape.lineTo(-halfWidth + cornerRadius, halfHeight);
	shape.quadraticCurveTo(
		-halfWidth,
		halfHeight,
		-halfWidth,
		halfHeight - cornerRadius
	);
	shape.lineTo(-halfWidth, -halfHeight + cornerRadius);
	shape.quadraticCurveTo(
		-halfWidth,
		-halfHeight,
		-halfWidth + cornerRadius,
		-halfHeight
	);
	return shape;
}

function createBody() {
	const geometry = new ExtrudeGeometry(bodyShape(), {
		bevelEnabled: true,
		bevelSegments: BODY.bevelSegments,
		bevelSize: BODY.bevelSize,
		bevelThickness: BODY.bevelThickness,
		curveSegments: BODY.curveSegments,
		depth: BODY.depth,
		steps: 1,
	});
	geometry.center();
	return geometry;
}

function createShackle() {
	const curve = new CatmullRomCurve3(
		SHACKLE.points.map(([x, y]) => new Vector3(x, y, 0)),
		false,
		SHACKLE_CURVE
	);
	return new TubeGeometry(
		curve,
		SHACKLE.tubeSegments,
		SHACKLE.radius,
		SHACKLE.radialSegments,
		false
	);
}

export function createPadlockGeometry() {
	return {
		body: createBody(),
		shackle: createShackle(),
		keyholeCircle: new CircleGeometry(
			KEYHOLE.circleRadius,
			KEYHOLE.circleSegments
		),
		keyholeStem: new PlaneGeometry(KEYHOLE.stemWidth, KEYHOLE.stemHeight),
		faceDepth: BODY.depth / 2 + BODY.bevelThickness + KEYHOLE.faceGap,
	};
}

export type PadlockGeometry = ReturnType<typeof createPadlockGeometry>;

export function disposePadlockGeometry(geometry: PadlockGeometry) {
	geometry.body.dispose();
	geometry.shackle.dispose();
	geometry.keyholeCircle.dispose();
	geometry.keyholeStem.dispose();
}
