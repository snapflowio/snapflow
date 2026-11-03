/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ShaderMaterial } from 'three';

const vertexShader = /* glsl */ `
	varying vec3 v_viewNormal;

	void main() {
		v_viewNormal = normalize(normalMatrix * normal);
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

const DITHER_GLSL = /* glsl */ `
	float hash(vec2 position) {
		return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
	}

	float bayer4(vec2 position) {
		vec2 cell = mod(floor(position), 4.0);
		float x = cell.x;
		float y = cell.y;
		float value = 0.0;

		if (y < 1.0) {
			if (x < 1.0) value = 0.0;
			else if (x < 2.0) value = 8.0;
			else if (x < 3.0) value = 2.0;
			else value = 10.0;
		} else if (y < 2.0) {
			if (x < 1.0) value = 12.0;
			else if (x < 2.0) value = 4.0;
			else if (x < 3.0) value = 14.0;
			else value = 6.0;
		} else if (y < 3.0) {
			if (x < 1.0) value = 3.0;
			else if (x < 2.0) value = 11.0;
			else if (x < 3.0) value = 1.0;
			else value = 9.0;
		} else {
			if (x < 1.0) value = 15.0;
			else if (x < 2.0) value = 7.0;
			else if (x < 3.0) value = 13.0;
			else value = 5.0;
		}

		return (value + 0.5) / 16.0;
	}
`;

const fragmentShader = /* glsl */ `
	uniform float u_time;
	uniform float u_densityOffset;
	varying vec3 v_viewNormal;

	${DITHER_GLSL}

	void main() {
		vec3 normal = normalize(v_viewNormal);
		vec3 light = normalize(vec3(-0.65, 0.8, 1.0));
		float diffuse = max(dot(normal, light), 0.0);
		float rim = pow(1.0 - abs(normal.z), 1.5);
		vec2 pixel = floor(gl_FragCoord.xy / 2.0);
		float staticFrame = floor(u_time * 9.0);
		float noise = hash(pixel + staticFrame * vec2(19.0, 29.0));
		float density = clamp(0.44 + diffuse * 0.38 + rim * 0.14 + (noise - 0.5) * 0.12 + u_densityOffset, 0.1, 0.94);
		float dither = step(bayer4(pixel), density);
		vec3 shadow = vec3(0.13, 0.02, 0.2);
		vec3 violet = vec3(0.61, 0.36, 0.9);
		vec3 paper = vec3(0.94, 0.93, 0.9);
		vec3 highlight = mix(violet, paper, 0.25 + diffuse * 0.6);
		vec3 color = mix(shadow, highlight, dither);
		gl_FragColor = vec4(color, 1.0);
	}
`;

export function createDitheredMaterial({
	densityOffset = 0,
}: {
	densityOffset?: number;
} = {}) {
	return new ShaderMaterial({
		fragmentShader,
		uniforms: {
			u_densityOffset: { value: densityOffset },
			u_time: { value: 0 },
		},
		vertexShader,
	});
}
