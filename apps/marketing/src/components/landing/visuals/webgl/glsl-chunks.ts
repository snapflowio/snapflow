/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BAYER_LEVELS,
	BAYER_MATRIX,
	DITHER_STYLE,
} from '@/components/landing/visuals/dither-style';

export const FULLSCREEN_VERTEX_SHADER = /* glsl */ `
attribute vec2 a_position;
void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const SIMPLEX_NOISE_GLSL = /* glsl */ `
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289v3(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
	const vec4 C = vec4(
		0.211324865405187,
		0.366025403784439,
		-0.577350269189626,
		0.024390243902439
	);
	vec2 i = floor(v + dot(v, C.yy));
	vec2 x0 = v - i + dot(i, C.xx);
	vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
	vec4 x12 = x0.xyxy + C.xxzz;
	x12.xy -= i1;
	i = mod289v2(i);
	vec3 p = permute(
		permute(i.y + vec3(0.0, i1.y, 1.0)) +
		i.x + vec3(0.0, i1.x, 1.0)
	);
	vec3 m = max(
		0.5 - vec3(
			dot(x0, x0),
			dot(x12.xy, x12.xy),
			dot(x12.zw, x12.zw)
		),
		0.0
	);
	m = m * m;
	m = m * m;
	vec3 x = 2.0 * fract(p * C.www) - 1.0;
	vec3 h = abs(x) - 0.5;
	vec3 ox = floor(x + 0.5);
	vec3 a0 = x - ox;
	m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
	vec3 g;
	g.x = a0.x * x0.x + h.x * x0.y;
	g.yz = a0.yz * x12.xz + h.yz * x12.yw;
	return 130.0 * dot(m, g);
}
`;

export const HASH_GLSL = /* glsl */ `
float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}
`;

const BAYER_LOOKUP = BAYER_MATRIX.flatMap((row, y) =>
	row.map(
		(level, x) =>
			`if (index == ${x + y * DITHER_STYLE.bayerSize}) return ${glslFloat(level / BAYER_LEVELS)};`
	)
).join('\n\t');

export const BAYER_GLSL = /* glsl */ `
float bayer4(vec2 position) {
	int x = int(mod(position.x, ${glslFloat(DITHER_STYLE.bayerSize)}));
	int y = int(mod(position.y, ${glslFloat(DITHER_STYLE.bayerSize)}));
	int index = x + y * ${DITHER_STYLE.bayerSize};
	${BAYER_LOOKUP}
	return 0.0;
}
`;

export function glslFloat(value: number) {
	return Number.isInteger(value) ? value.toFixed(1) : String(value);
}
