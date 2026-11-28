/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Color, ShaderMaterial, SRGBColorSpace, Vector3 } from 'three';
import {
	BAYER_CELL_OFFSET,
	DITHER_RAMP_TOKENS,
	DITHER_STYLE,
} from '@/components/landing/visuals/dither-style';
import { BAYER_GLSL } from '@/components/landing/visuals/webgl/glsl-chunks';
import { GLINT_SWEEP, LIGHTING } from './usdc-coin-config';

const GLSL_DECIMALS = 4;
const RAMP_STEPS = DITHER_RAMP_TOKENS.length - 1;

function glslFloat(value: number) {
	const fixed = value.toFixed(GLSL_DECIMALS);
	return fixed.includes('.') ? fixed : `${fixed}.0`;
}

function glslVec3([x, y, z]: readonly [number, number, number]) {
	return `vec3(${glslFloat(x)}, ${glslFloat(y)}, ${glslFloat(z)})`;
}

function rampLookup() {
	return Array.from(
		{ length: RAMP_STEPS },
		(_, index) =>
			`if (level < ${glslFloat(index + 1)}) return u_ramp[${index}];`
	).join('\n\t\t');
}

const vertexShader = `
	varying vec3 v_viewNormal;
	varying vec2 v_viewPosition;

	void main() {
		vec4 localPosition = vec4(position, 1.0);
		vec3 localNormal = normal;
		#ifdef USE_INSTANCING
			localPosition = instanceMatrix * localPosition;
			localNormal = mat3(instanceMatrix) * localNormal;
		#endif
		vec4 viewPosition = modelViewMatrix * localPosition;
		v_viewNormal = normalize(normalMatrix * localNormal);
		v_viewPosition = viewPosition.xy;
		gl_Position = projectionMatrix * viewPosition;
	}
`;

const fragmentShader = `
	uniform float u_time;
	uniform float u_densityOffset;
	uniform float u_sweepAmount;
	uniform bool u_sparkle;
	uniform vec3 u_ramp[${DITHER_RAMP_TOKENS.length}];
	uniform vec3 u_glint;
	varying vec3 v_viewNormal;
	varying vec2 v_viewPosition;

	float hash(vec2 position) {
		return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
	}

	${BAYER_GLSL}

	vec3 rampColor(float level) {
		${rampLookup()}
		return u_ramp[${RAMP_STEPS}];
	}

	void main() {
		vec3 normal = normalize(v_viewNormal);
		float key = max(dot(normal, normalize(${glslVec3(LIGHTING.keyDirection)})), 0.0);
		float fill = max(dot(normal, normalize(${glslVec3(LIGHTING.fillDirection)})), 0.0);
		float rim = pow(1.0 - abs(normal.z), ${glslFloat(LIGHTING.rimPower)});

		vec2 pixel = floor(gl_FragCoord.xy);
		float threshold = bayer4(pixel) + ${glslFloat(BAYER_CELL_OFFSET)};

		float falloff = (v_viewPosition.y - v_viewPosition.x * ${glslFloat(LIGHTING.falloffAcross)}) * ${glslFloat(LIGHTING.falloff)};
		float light = clamp(
			${glslFloat(LIGHTING.ambient)} + key * ${glslFloat(LIGHTING.key)} + fill * ${glslFloat(LIGHTING.fill)} + falloff + u_densityOffset,
			0.0,
			1.0
		);
		float scaled = clamp(light * ${glslFloat(RAMP_STEPS)} + rim * ${glslFloat(DITHER_STYLE.edgeLift)}, 0.0, ${glslFloat(RAMP_STEPS)});
		float level = floor(scaled);
		float blend = clamp((fract(scaled) - 0.5) / ${glslFloat(LIGHTING.bandWidth)} + 0.5, 0.0, 1.0);
		vec3 color = threshold < blend ? rampColor(level + 1.0) : rampColor(level);

		float sweepAt = mod(u_time * ${glslFloat(GLINT_SWEEP.speed)}, ${glslFloat(GLINT_SWEEP.period)}) - ${glslFloat(GLINT_SWEEP.offset)};
		float sweep = 1.0 - smoothstep(0.0, ${glslFloat(GLINT_SWEEP.width)}, abs(v_viewPosition.x + v_viewPosition.y * ${glslFloat(GLINT_SWEEP.slant)} - sweepAt));
		if (threshold < sweep * light * u_sweepAmount) color = u_glint;

		float glint = hash(pixel + floor(u_time * ${glslFloat(LIGHTING.glintRate)}));
		if (u_sparkle && key > ${glslFloat(LIGHTING.glintMinimumKey)} && glint > ${glslFloat(LIGHTING.glintThreshold)}) color = u_glint;

		gl_FragColor = vec4(color, 1.0);
	}
`;

function readToken(styles: CSSStyleDeclaration, token: string) {
	const value = styles.getPropertyValue(token).trim();
	if (!value) {
		throw new Error(`The USDC coin needs ${token} in global.css`);
	}
	const color = new Color().setStyle(value);
	const srgb = new Color();
	color.getRGB(srgb, SRGBColorSpace);
	return new Vector3(srgb.r, srgb.g, srgb.b);
}

export function readCoinColors() {
	const styles = getComputedStyle(document.documentElement);
	const ramp = DITHER_RAMP_TOKENS.map((token) => readToken(styles, token));
	return {
		ramp,
		glint: readToken(styles, DITHER_RAMP_TOKENS[RAMP_STEPS]),
	};
}

export type CoinColors = ReturnType<typeof readCoinColors>;

export type DitherFinish = {
	densityOffset: number;
	glint: boolean;
	sparkle?: boolean;
};

export function createCoinMaterial(
	{ densityOffset, glint, sparkle = true }: DitherFinish,
	colors: CoinColors
) {
	return new ShaderMaterial({
		fragmentShader,
		vertexShader,
		uniforms: {
			u_time: { value: 0 },
			u_densityOffset: { value: densityOffset },
			u_sweepAmount: { value: glint ? GLINT_SWEEP.amount : 0 },
			u_sparkle: { value: sparkle },
			u_ramp: { value: colors.ramp },
			u_glint: { value: colors.glint },
		},
	});
}
