/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BAYER_CELL_OFFSET,
	DITHER_STYLE,
} from '@/components/landing/visuals/dither-style';
import {
	BAYER_GLSL,
	glslFloat as f,
	SIMPLEX_NOISE_GLSL,
} from '../webgl/glsl-chunks';
import { BLEND, HALO, PLANET, SHADING } from './globe-horizon-config';

export const globeHorizonUniformNames = ['u_rotation', 'u_radius'] as const;

export const globeHorizonFragmentShader = /* glsl */ `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_rotation;
uniform float u_radius;
uniform sampler2D u_land;
uniform vec3 u_ink;
uniform vec3 u_night;
uniform vec3 u_nightBright;
uniform vec3 u_brand;
uniform vec3 u_brandBright;
uniform vec3 u_paper;

${SIMPLEX_NOISE_GLSL}
${BAYER_GLSL}

const float PI = 3.141592653589793;

vec3 rampColor(float level) {
	if (level < 0.5) return u_ink;
	if (level < 1.5) return u_night;
	if (level < 2.5) return u_nightBright;
	if (level < 3.5) return u_brand;
	if (level < 4.5) return u_brandBright;
	return u_paper;
}

vec3 dithered(float level, float threshold) {
	float base = floor(level);
	return threshold < fract(level) ? rampColor(base + 1.0) : rampColor(base);
}

bool covers(float coverage, float threshold) {
	return threshold < coverage;
}

void main() {
	vec2 pixel = floor(gl_FragCoord.xy);
	vec2 uv = (pixel + 0.5) / u_resolution;
	float threshold = bayer4(pixel) + ${f(BAYER_CELL_OFFSET)};
	vec2 surface = (pixel + 0.5 - vec2(u_resolution.x * 0.5, 0.0)) / u_radius;
	float distanceFromCenter = length(surface);
	vec3 color = u_ink;

	if (distanceFromCenter < 1.0) {
		vec3 view = vec3(surface, sqrt(1.0 - distanceFromCenter * distanceFromCenter));
		float tiltCos = cos(${f(PLANET.tilt)});
		float tiltSin = sin(${f(PLANET.tilt)});
		vec3 tilted = vec3(view.x, view.y * tiltCos + view.z * tiltSin, view.z * tiltCos - view.y * tiltSin);
		float spinCos = cos(u_rotation);
		float spinSin = sin(u_rotation);
		vec3 world = vec3(tilted.x * spinCos - tilted.z * spinSin, tilted.y, tilted.x * spinSin + tilted.z * spinCos);
		float latitude = asin(clamp(world.y, -1.0, 1.0));
		float longitude = atan(world.z, -world.x) - PI;
		vec2 landUv = vec2(fract(longitude / (2.0 * PI) + 0.5), 0.5 - latitude / PI);
		bool land = texture2D(u_land, landUv).r > ${f(SHADING.coastline)};

		vec3 light = normalize(vec3(${f(SHADING.lightX)}, ${f(SHADING.lightY)}, ${f(SHADING.lightZ)}));
		float diffuse = max(dot(view, light), 0.0);
		float daylight = smoothstep(0.0, ${f(SHADING.terminatorWidth)}, diffuse + ${f(SHADING.terminatorOffset)});
		float rim = smoothstep(${f(SHADING.rimStart)}, 1.0, distanceFromCenter);

		float level = land
			? mix(${f(SHADING.landNight)}, ${f(SHADING.land)} + diffuse * ${f(SHADING.landLight)}, daylight)
			: mix(${f(SHADING.oceanNight)}, ${f(SHADING.ocean)} + diffuse * ${f(SHADING.oceanLight)}, daylight);
		level += rim * ${f(DITHER_STYLE.edgeLift)};
		color = dithered(level, threshold);

	} else {
		float halo = exp(-(distanceFromCenter - 1.0) * ${f(HALO.falloff)}) * ${f(HALO.strength)};
		halo *= smoothstep(0.0, ${f(HALO.topFade)}, 1.0 - uv.y);
		color = dithered(halo, threshold);
	}

	float ragged = snoise(uv * vec2(u_resolution.x / u_resolution.y, 1.0) * ${f(BLEND.noiseScale)}) * ${f(BLEND.noiseAmount)};
	float sideFade = distanceFromCenter < 1.0 ? ${f(BLEND.planetSideFade)} : ${f(BLEND.sideFade)};
	float sides = smoothstep(0.0, sideFade, min(uv.x, 1.0 - uv.x) + ragged);
	if (!covers(sides, threshold)) color = u_ink;

	gl_FragColor = vec4(color, 1.0);
}
`;
