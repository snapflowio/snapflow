/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BAYER_CELL_OFFSET } from '@/components/landing/visuals/dither-style';
import {
	BAYER_GLSL,
	glslFloat as f,
	HASH_GLSL,
	SIMPLEX_NOISE_GLSL,
} from '../webgl/glsl-chunks';
import {
	CLIFF_BASE_BELOW_HORIZON,
	EDGE_FADE,
	GLINT,
	RIPPLE,
	RIVER,
	SCENE,
	TERRAIN,
	WATERFALL,
} from './river-config';

export const riverUniformNames = ['u_horizon', 'u_ripples'] as const;

export const riverFragmentShader = /* glsl */ `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_horizon;
uniform vec3 u_bank;
uniform vec3 u_deep;
uniform vec3 u_mid;
uniform vec3 u_current;
uniform vec3 u_ripple;
uniform vec3 u_glint;
uniform vec3 u_page;
uniform vec4 u_ripples[${RIPPLE.capacity}];

${SIMPLEX_NOISE_GLSL}
${HASH_GLSL}
${BAYER_GLSL}

float riverCenter(float depth) {
	float progress = clamp(
		(depth - ${f(SCENE.nearDepth)}) / ${f(SCENE.cliffDepth - SCENE.nearDepth)},
		0.0,
		1.0
	);
	float bend = sin(progress * ${f(SCENE.pi * RIVER.bends)}) * ${f(RIVER.bendAmplitude)} *
		min(progress / ${f(RIVER.straightReach)}, 1.0);
	float wobble = sin(depth * ${f(RIVER.wobbleFrequency)}) * ${f(RIVER.wobbleAmplitude)} *
		progress * (1.0 - progress) * 4.0;
	return bend + wobble;
}

float riverHalfWidth(float depth) {
	return ${f(RIVER.halfWidth)} *
		(1.0 + ${f(RIVER.widthVariation)} * sin(depth * ${f(RIVER.widthFrequency)} + ${f(RIVER.widthPhase)}));
}

float fbm(vec2 position) {
	float value = 0.0;
	float amplitude = 0.5;
	for (int octave = 0; octave < 3; octave++) {
		value += amplitude * snoise(position);
		position = position * 2.03 + vec2(1.7, 9.2);
		amplitude *= 0.5;
	}
	return value;
}

float lineMask(float value, float count, float width) {
	float band = fract(value * count);
	return 1.0 - smoothstep(0.0, width, min(band, 1.0 - band) * 2.0);
}

bool covers(float coverage, float threshold) {
	return threshold < coverage;
}

float rippleCoverage(float worldX, float depth) {
	float coverage = 0.0;
	for (int index = 0; index < ${RIPPLE.capacity}; index++) {
		vec4 ripple = u_ripples[index];
		float age = u_time - ripple.z;
		if (ripple.w <= 0.0 || age < 0.0 || age > ${f(RIPPLE.lifetimeSeconds)}) continue;
		vec2 center = vec2(ripple.x, ripple.y - age * ${f(RIPPLE.drift)});
		float distanceToCenter = length(vec2(worldX, depth) - center);
		float maxRadius = ${f(RIPPLE.maxRadius)} * ripple.w;
		for (int ring = 0; ring < ${RIPPLE.rings}; ring++) {
			float ringAge = age - float(ring) * ${f(RIPPLE.ringStaggerSeconds)};
			float progress = ringAge / ${f(RIPPLE.ringSeconds)};
			if (progress <= 0.0 || progress >= 1.0) continue;
			float remaining = 1.0 - progress;
			float radius = maxRadius * (1.0 - remaining * remaining * remaining);
			float width = ${f(RIPPLE.width)} * (1.0 + progress * ${f(RIPPLE.widthGrowth)});
			float crest = 1.0 - smoothstep(0.0, width, abs(distanceToCenter - radius));
			float amplitude = remaining * sqrt(remaining) * pow(${f(RIPPLE.ringFalloff)}, float(ring));
			coverage = max(coverage, crest * amplitude * ripple.w);
		}
	}
	return coverage;
}

float mist(float worldX, float height, float depthFromCliff) {
	float halfWidth = riverHalfWidth(${f(SCENE.cliffDepth)});
	vec3 offset = vec3(
		(worldX - riverCenter(${f(SCENE.cliffDepth)})) / (halfWidth * 1.5),
		height / ${f(WATERFALL.mistHeight)},
		depthFromCliff / ${f(WATERFALL.mistReach)}
	);
	float density = exp(-dot(offset, offset) * 2.0);
	float churn = snoise(vec2(worldX * 2.5, height * 3.0 - u_time * ${f(WATERFALL.mistRise)})) * 0.5 + 0.5;
	return density * mix(0.45, 1.0, churn) * ${f(WATERFALL.mistStrength)};
}

vec3 cliff(float worldX, float height, float threshold) {
	float ridge = ${f(SCENE.cliffHeight)} +
		fbm(vec2(worldX * 0.5, 3.1)) * ${f(SCENE.ridgeRoughness)} * 2.0;
	if (height > ridge) return u_bank;

	float topProgress = clamp(height / ridge, 0.0, 1.0);
	float fallHalfWidth = riverHalfWidth(${f(SCENE.cliffDepth)}) *
		mix(1.0, ${f(WATERFALL.lipWidth)}, topProgress);
	float across = (worldX - riverCenter(${f(SCENE.cliffDepth)})) / fallHalfWidth;
	float raggedEdge = 1.0 + snoise(vec2(height * 4.0 + u_time * ${f(WATERFALL.fallSpeed)}, worldX)) * 0.06;

	vec3 color;
	if (abs(across) < raggedEdge) {
		float fall = height + u_time * ${f(WATERFALL.fallSpeed)};
		float sheet = snoise(vec2(across * 5.0, fall * 1.1)) * 0.5 + 0.5;
		float streak = snoise(vec2(across * 11.0, fall * 0.45)) * 0.5 + 0.5;
		color = covers(0.35 + sheet * 0.4, threshold) ? u_mid : u_deep;
		if (covers(smoothstep(0.45, 0.8, streak), threshold)) color = u_current;
		float lip = smoothstep(ridge - ${f(WATERFALL.lipBand)}, ridge, height);
		float spray = smoothstep(0.7, 0.95, sheet) + lip;
		if (covers(spray, threshold)) color = u_glint;
	} else {
		float strata = lineMask(
			height + fbm(vec2(worldX * 0.35, height * 0.4)) * 0.25,
			${f(TERRAIN.strataPerUnit)},
			${f(TERRAIN.strataWidth)}
		);
		float shade = 1.0 - smoothstep(1.0, 3.0, abs(across));
		float rock = max(
			${f(TERRAIN.rockFill)},
			strata * mix(${f(TERRAIN.strataStrength)}, 0.9, shade)
		);
		color = covers(rock, threshold) ? u_deep : u_bank;
		float rim = smoothstep(ridge - ${f(TERRAIN.rimWidth)}, ridge, height);
		if (covers(rim * ${f(TERRAIN.rimStrength)}, threshold)) color = u_mid;
	}
	float plunge = 1.0 - smoothstep(0.0, ${f(WATERFALL.plungeHeight)}, height);
	if (abs(across) < raggedEdge && covers(plunge, threshold)) color = u_glint;
	if (covers(mist(worldX, height, 0.0), threshold)) color = u_glint;
	return color;
}

vec3 ground(vec2 pixel, float worldX, float depth, float threshold) {
	float halfWidth = riverHalfWidth(depth);
	float across = (worldX - riverCenter(depth)) / halfWidth;
	float edge = abs(across);
	float nearness = smoothstep(${f(SCENE.cliffDepth)}, ${f(SCENE.nearDepth)}, depth);
	float depthFromCliff = ${f(SCENE.cliffDepth)} - depth;
	float spray = mist(worldX, 0.0, depthFromCliff);

	if (edge > 1.0) {
		float terrain = fbm(vec2(worldX, depth) * ${f(TERRAIN.contourScale)}) * 0.5 + 0.5;
		float contour = lineMask(terrain, ${f(TERRAIN.contourCount)}, ${f(TERRAIN.contourWidth)});
		float shore = 1.0 - smoothstep(1.0, 2.5, edge);
		float lines = contour * mix(${f(TERRAIN.contourStrength)}, 1.0, shore * 0.5) * mix(0.35, 1.0, nearness);
		vec3 bank = covers(lines, threshold) ? u_deep : u_bank;
		return covers(spray, threshold) ? u_glint : bank;
	}

	float flow = depth + u_time * ${f(RIVER.flowSpeed)};
	float channel = 1.0 - edge * edge;
	float body = fbm(vec2(worldX * 1.1, flow * 0.55)) * 0.5 + 0.5;
	float swirl = mix(0.12, 0.72, body) * (0.55 + 0.45 * channel) * mix(0.45, 1.0, nearness);
	vec3 color = covers(swirl, threshold) ? u_mid : u_deep;

	float streak = snoise(vec2(across * halfWidth * 4.0, flow * 0.5 + u_time * 0.3));
	float current = smoothstep(0.45, 0.85, streak) * channel * mix(0.5, 1.0, nearness);
	if (covers(current, threshold)) color = u_current;

	float churn = snoise(vec2(worldX * 3.0, flow * 2.0)) * 0.5 + 0.5;
	float pool = smoothstep(${f(SCENE.cliffDepth - WATERFALL.poolReach)}, ${f(SCENE.cliffDepth)}, depth) * churn;
	float shoreFoam = smoothstep(0.9, 1.0, edge) * smoothstep(0.45, 1.0, churn) * nearness;
	if (covers(max(pool, shoreFoam), threshold)) color = u_glint;

	if (covers(rippleCoverage(worldX, depth), threshold)) color = u_ripple;

	float sparkle = hash(pixel + floor(u_time * ${f(GLINT.rate)}));
	if (sparkle > ${f(GLINT.threshold)} && body > ${f(GLINT.minimumBody)}) color = u_glint;

	return covers(spray, threshold) ? u_glint : color;
}

void main() {
	vec2 pixel = floor(gl_FragCoord.xy);
	vec2 uv = (pixel + 0.5) / u_resolution;
	float aspect = max(u_resolution.x / u_resolution.y, ${f(SCENE.minimumAspect)});
	float threshold = bayer4(pixel) + ${f(BAYER_CELL_OFFSET)};
	float below = u_horizon - uv.y;
	float edgeFade = smoothstep(0.0, ${f(EDGE_FADE.top)}, 1.0 - uv.y) *
		smoothstep(0.0, ${f(EDGE_FADE.bottom)}, uv.y);

	vec3 color;
	if (below > ${f(CLIFF_BASE_BELOW_HORIZON)}) {
		float depth = ${f(SCENE.cameraHeight)} / below;
		float worldX = (uv.x - 0.5) * aspect * depth;
		color = ground(pixel, worldX, depth, threshold);
	} else {
		float worldX = (uv.x - 0.5) * aspect * ${f(SCENE.cliffDepth)};
		float height = (${f(CLIFF_BASE_BELOW_HORIZON)} - below) * ${f(SCENE.cliffDepth)};
		color = cliff(worldX, height, threshold);
	}
	gl_FragColor = vec4(covers(edgeFade, threshold) ? color : u_page, 1.0);
}
`;
