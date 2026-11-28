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
	HASH_GLSL,
	SIMPLEX_NOISE_GLSL,
} from '../webgl/glsl-chunks';
import {
	CLEAR_ZONE,
	FIELD,
	GROUND,
	LEDS,
	PLACEMENT,
	RACK,
	SHADING,
	VIGNETTE,
} from './machine-field-config';

const NO_HIT = 100000;
const MAX_MACHINE_HEIGHT = (RACK.maxUnits + RACK.towerUnits) * RACK.unitPitch;

export const machineFieldFragmentShader = /* glsl */ `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_ink;
uniform vec3 u_night;
uniform vec3 u_nightBright;
uniform vec3 u_brand;
uniform vec3 u_brandBright;
uniform vec3 u_paper;
uniform vec3 u_aqua;
uniform vec4 u_clear;

${HASH_GLSL}
${SIMPLEX_NOISE_GLSL}
${BAYER_GLSL}

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

float machineHeight(vec2 cell) {
	if (cell.y < ${f(FIELD.firstRow)}) return 0.0;
	if (mod(cell.x, ${f(FIELD.aisleEvery)}) == 0.0) return 0.0;
	if (hash(cell * 1.71 + 3.1) < ${f(FIELD.emptyChance)}) return 0.0;
	float tower = step(${f(FIELD.towerChance)}, hash(cell * 3.37 + 0.7));
	float units = floor(mix(${f(RACK.minUnits)}, ${f(RACK.maxUnits + 1)}, hash(cell + 9.13)));
	return (units + tower * ${f(RACK.towerUnits)}) * ${f(RACK.unitPitch)};
}

vec3 pickedMachine(float cycle) {
	for (int attempt = 0; attempt < ${PLACEMENT.pickAttempts}; attempt++) {
		vec2 seed = vec2(cycle, float(attempt));
		vec2 cell = vec2(
			floor(hash(seed + vec2(0.0, 1.3)) * ${f(PLACEMENT.pickSpanX * 2 + 1)}) - ${f(PLACEMENT.pickSpanX)},
			${f(PLACEMENT.pickNearRow)} + floor(hash(seed + vec2(0.0, 7.9)) * ${f(PLACEMENT.pickRows)})
		);
		float height = machineHeight(cell);
		if (height > 0.0) return vec3(cell, height);
	}
	return vec3(0.0);
}

void main() {
	vec2 pixel = floor(gl_FragCoord.xy);
	vec2 uv = (pixel + 0.5) / u_resolution;
	float aspect = u_resolution.x / u_resolution.y;
	float threshold = bayer4(pixel) + ${f(BAYER_CELL_OFFSET)};

	vec3 origin = vec3(0.0, ${f(FIELD.cameraHeight)}, 0.0);
	vec3 ray = normalize(vec3((uv.x - 0.5) * aspect, uv.y - ${f(FIELD.horizon)}, ${f(FIELD.focalLength)}));
	ray += vec3(0.00001);

	float cycle = floor(u_time / ${f(PLACEMENT.pickSeconds)});
	float phase = fract(u_time / ${f(PLACEMENT.pickSeconds)});
	vec3 pick = pickedMachine(cycle);
	vec2 picked = pick.xy;
	float pickedHeight = pick.z;
	float glow = step(0.0001, pickedHeight) * smoothstep(0.0, 0.12, phase) * (1.0 - smoothstep(0.85, 1.0, phase));
	float sweepX = origin.x + (fract(u_time / ${f(PLACEMENT.sweepSeconds)}) * 2.0 - 1.0) * ${f(PLACEMENT.sweepRange)};

	float groundT = ray.y < 0.0 ? -origin.y / ray.y : ${f(NO_HIT)};
	float limit = min(groundT, ${f(FIELD.maxDistance)});

	vec2 cell = floor(origin.xz);
	vec2 stepDirection = sign(ray.xz);
	vec2 tDelta = abs(1.0 / ray.xz);
	vec2 sideT = (stepDirection * (cell - origin.xz) + stepDirection * 0.5 + 0.5) * tDelta;
	float cellEntry = 0.0;
	float hitT = ${f(NO_HIT)};
	vec3 hitNormal = vec3(0.0);
	vec2 hitCell = vec2(0.0);
	float hitHeight = 0.0;

	for (int index = 0; index < ${FIELD.maxSteps}; index++) {
		if (cellEntry > limit) break;
		float height = machineHeight(cell);
		if (height > 0.0) {
			vec3 center = vec3(cell.x + 0.5, 0.0, cell.y + 0.5);
			vec3 boxMin = vec3(center.x - ${f(FIELD.halfWidth)}, 0.0, center.z - ${f(FIELD.halfDepth)});
			vec3 boxMax = vec3(center.x + ${f(FIELD.halfWidth)}, height, center.z + ${f(FIELD.halfDepth)});
			vec3 t0 = (boxMin - origin) / ray;
			vec3 t1 = (boxMax - origin) / ray;
			vec3 tNear = min(t0, t1);
			vec3 tFar = max(t0, t1);
			float enter = max(max(tNear.x, tNear.y), tNear.z);
			float leave = min(min(tFar.x, tFar.y), tFar.z);
			if (enter < leave && leave > 0.0) {
				hitT = enter;
				hitCell = cell;
				hitHeight = height;
				if (enter == tNear.x) hitNormal = vec3(-sign(ray.x), 0.0, 0.0);
				else if (enter == tNear.y) hitNormal = vec3(0.0, -sign(ray.y), 0.0);
				else hitNormal = vec3(0.0, 0.0, -sign(ray.z));
				break;
			}
		}
		if (sideT.x < sideT.y) {
			cellEntry = sideT.x;
			sideT.x += tDelta.x;
			cell.x += stepDirection.x;
		} else {
			cellEntry = sideT.y;
			sideT.y += tDelta.y;
			cell.y += stepDirection.y;
		}
	}

	vec3 color;
	if (hitT < ${f(NO_HIT)}) {
		vec3 point = origin + ray * hitT;
		vec3 local = point - vec3(hitCell.x + 0.5, 0.0, hitCell.y + 0.5);
		float fog = smoothstep(${f(FIELD.fogNear)}, ${f(FIELD.fogFar)}, hitT);
		bool top = hitNormal.y > 0.5;
		bool front = hitNormal.z < -0.5;
		bool isPicked = hitCell.x == picked.x && hitCell.y == picked.y;
		float detail = 1.0 - smoothstep(${f(RACK.detailNear)}, ${f(RACK.detailFar)}, hitT);
		float level = top ? ${f(SHADING.top)} : (front ? ${f(SHADING.front)} : ${f(SHADING.side)});
		level += point.y / ${f(MAX_MACHINE_HEIGHT)} * ${f(SHADING.heightGain)};

		float edgeAcross = top
			? max(abs(local.x) / ${f(FIELD.halfWidth)}, abs(local.z) / ${f(FIELD.halfDepth)})
			: (front ? abs(local.x) / ${f(FIELD.halfWidth)} : abs(local.z) / ${f(FIELD.halfDepth)});
		float edge = max(
			step(${f(SHADING.outlineEdge)}, edgeAcross),
			top ? 0.0 : step(hitHeight - point.y, ${f(SHADING.outline)})
		);
		float rim = max(
			step(${f(RACK.bevelEdge)}, edgeAcross),
			top ? 0.0 : step(hitHeight - point.y, ${f(RACK.bevelTop)})
		);
		level += rim * ${f(DITHER_STYLE.edgeLift)} * detail;

		if (top) {
			vec2 panel = vec2(local.x / ${f(FIELD.halfWidth)}, local.z / ${f(FIELD.halfDepth)}) * 0.5 + 0.5;
			vec2 grid = abs(fract(panel * vec2(${f(RACK.panelColumns)}, ${f(RACK.panelRows)})) - 0.5);
			float seam = step(0.5 - ${f(RACK.panelSeam)}, max(grid.x, grid.y));
			level += mix(-${f(RACK.panelDim)}, ${f(RACK.panelSeamLift)}, seam) * detail * (1.0 - rim);
		}

		float unit = floor(point.y / ${f(RACK.unitPitch)});
		float inUnit = fract(point.y / ${f(RACK.unitPitch)});
		float across = local.x / ${f(FIELD.halfWidth)};
		bool ledSlot = false;
		if (front && rim == 0.0) {
			level -= step(inUnit, ${f(RACK.unitSeam)}) * ${f(RACK.unitSeamDim)} * detail;
			bool vent = across > ${f(RACK.ventLeft)} && across < ${f(RACK.ventRight)} &&
				inUnit > ${f(RACK.ventBottom)} && inUnit < ${f(RACK.ventTop)} &&
				fract(across * ${f(RACK.ventCount)}) < ${f(RACK.ventDuty)};
			if (vent) level -= ${f(RACK.ventDim)} * detail;
			ledSlot = across > ${f(LEDS.left)} && across < ${f(LEDS.right)} &&
				inUnit > ${f(LEDS.bottom)} && inUnit < ${f(LEDS.top)};
			if (ledSlot) level -= ${f(LEDS.offDim)} * detail;
		}
		color = dithered(mix(level, ${f(SHADING.far)}, fog), threshold);

		float sweep = 1.0 - smoothstep(0.0, ${f(PLACEMENT.sweepWidth)}, abs(hitCell.x + 0.5 - sweepX));
		if (edge > 0.0 && covers(sweep * (1.0 - fog), threshold)) color = u_brandBright;

		if (ledSlot && hitT < ${f(LEDS.maxDistance)}) {
			float blink = hash(hitCell * 5.3 + unit + floor(u_time * ${f(LEDS.rate)} * (0.5 + hash(hitCell + unit))));
			bool lit = isPicked ? covers(glow, threshold) : blink > ${f(LEDS.onChance)};
			if (lit) color = u_aqua;
		}

		if (isPicked) {
			if (edge > 0.0 && covers(glow, threshold)) color = u_aqua;
			if (top && covers(glow * 0.6, threshold)) color = u_paper;
		}
	} else if (ray.y < 0.0) {
		vec3 point = origin + ray * groundT;
		float fog = smoothstep(${f(FIELD.fogNear)}, ${f(FIELD.fogFar)}, groundT);
		vec2 aisle = abs(fract(point.xz) - 0.5);
		float line = smoothstep(0.5 - ${f(GROUND.gridWidth)}, 0.5, max(aisle.x, aisle.y));
		vec2 toPicked = point.xz - (picked + 0.5);
		float pool = exp(-dot(toPicked, toPicked) * 2.0) * glow * ${f(PLACEMENT.poolStrength)};
		color = covers(line * ${f(GROUND.gridLevel)} * (1.0 - fog), threshold) ? u_night : u_ink;
		if (covers(pool, threshold)) color = u_nightBright;
	} else {
		float haze = exp(-(uv.y - ${f(FIELD.horizon)}) * ${f(GROUND.hazeFalloff)}) * ${f(GROUND.hazeStrength)};
		color = covers(haze, threshold) ? u_night : u_ink;
	}

	vec2 toBeam = picked + 0.5 - origin.xz;
	vec2 heading = normalize(ray.xz);
	float along = dot(toBeam, heading);
	float beamT = along / length(ray.xz);
	float beamY = origin.y + ray.y * beamT;
	float offAxis = abs(toBeam.x * heading.y - toBeam.y * heading.x);
	if (along > 0.0 && beamT < hitT && beamY > pickedHeight) {
		float beam = (1.0 - smoothstep(0.0, ${f(PLACEMENT.beamRadius)}, offAxis)) * glow *
			(1.0 - smoothstep(pickedHeight, pickedHeight + ${f(PLACEMENT.beamHeight)}, beamY));
		if (covers(beam, threshold)) color = beam > 0.6 ? u_paper : u_aqua;
	}

	vec2 fromCenter = (uv - vec2(0.5, ${f(VIGNETTE.centerY)})) / vec2(${f(VIGNETTE.radiusX)}, ${f(VIGNETTE.radiusY)});
	float ragged = snoise(uv * vec2(aspect, 1.0) * ${f(VIGNETTE.noiseScale)}) * ${f(VIGNETTE.noiseAmount)};
	float blend = 1.0 - smoothstep(${f(VIGNETTE.inner)}, 1.0, length(fromCenter) + ragged);
	blend *= smoothstep(0.0, ${f(VIGNETTE.guard)}, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
	vec2 fromText = (uv - u_clear.xy) / max(u_clear.zw, vec2(${f(CLEAR_ZONE.minRadius)}));
	blend *= smoothstep(1.0, ${f(CLEAR_ZONE.falloff)}, length(fromText) + ragged);
	if (!covers(blend, threshold)) color = u_ink;

	gl_FragColor = vec4(color, 1.0);
}
`;
