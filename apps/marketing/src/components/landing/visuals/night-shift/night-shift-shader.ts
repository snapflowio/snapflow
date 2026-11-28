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
	type Box,
	CABLE,
	CAMERA,
	CHAIR,
	DESK,
	FADE,
	KEYBOARD,
	LAMP,
	MACHINE,
	MARCH,
	MONITOR,
	MOON,
	PLANT,
	ROOM,
	RUG,
	SHADING,
	SHELF,
	SKY,
	SPARKS,
	type Triple,
	WINDOW,
} from './night-shift-config';

export const nightShiftUniformNames = [
	'u_frame',
	'u_power',
	'u_rows',
	'u_screen',
	'u_link',
	'u_work',
] as const;

const Material = {
	FLOOR: 1,
	BACK_WALL: 2,
	LEFT_WALL: 3,
	FRAME: 4,
	DESK: 5,
	MONITOR: 6,
	MACHINE: 7,
	PORT: 8,
	CABLE: 9,
	KEYBOARD: 10,
	LAMP_SHADE: 11,
	LAMP_METAL: 12,
	CHAIR: 13,
	RUG: 14,
	SHELF: 15,
	BOOK: 16,
	POT: 17,
	LEAVES: 18,
} as const;

const BASE_LEVELS: readonly (readonly [number, number])[] = [
	[Material.FLOOR, SHADING.floor],
	[Material.BACK_WALL, SHADING.backWall],
	[Material.LEFT_WALL, SHADING.leftWall],
	[Material.FRAME, SHADING.frame],
	[Material.DESK, SHADING.desk],
	[Material.MONITOR, SHADING.monitor],
	[Material.MACHINE, SHADING.machine],
	[Material.PORT, SHADING.port],
	[Material.CABLE, SHADING.cable],
	[Material.KEYBOARD, SHADING.keyboard],
	[Material.LAMP_SHADE, SHADING.lampShade],
	[Material.LAMP_METAL, SHADING.lampMetal],
	[Material.CHAIR, SHADING.chair],
	[Material.RUG, SHADING.rug],
	[Material.SHELF, SHADING.shelf],
	[Material.BOOK, SHADING.book],
	[Material.POT, SHADING.pot],
	[Material.LEAVES, SHADING.leaves],
];

const HALF = 0.5;
const EDGE_AXES = 2;
const NO_EDGE = -1;
const WORLD_UP: Triple = [0, 1, 0];

function cross(a: Triple, b: Triple): Triple {
	return [
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0],
	];
}

function dot(a: Triple, b: Triple) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(a: Triple): Triple {
	const length = Math.hypot(...a);
	return [a[0] / length, a[1] / length, a[2] / length];
}

const VIEW_RAY = normalize(CAMERA.direction);
const VIEW_RIGHT = normalize(cross(VIEW_RAY, WORLD_UP));
const VIEW_UP = cross(VIEW_RIGHT, VIEW_RAY);
const ROOM_CORNERS: readonly Triple[] = [
	-ROOM.wallThickness,
	ROOM.size,
].flatMap((x) =>
	[-ROOM.slabThickness, ROOM.height].flatMap((y) =>
		[-ROOM.wallThickness, ROOM.size].map((z): Triple => [x, y, z])
	)
);
const PROJECTED_RIGHT = ROOM_CORNERS.map((corner) => dot(corner, VIEW_RIGHT));
const PROJECTED_UP = ROOM_CORNERS.map((corner) => dot(corner, VIEW_UP));
const VIEW_CENTER_RIGHT =
	(Math.min(...PROJECTED_RIGHT) + Math.max(...PROJECTED_RIGHT)) * HALF;
const VIEW_CENTER_UP =
	(Math.min(...PROJECTED_UP) + Math.max(...PROJECTED_UP)) * HALF;
const VIEW_HALF_WIDTH =
	(Math.max(...PROJECTED_RIGHT) - Math.min(...PROJECTED_RIGHT)) *
	HALF *
	CAMERA.margin;
const VIEW_HALF_HEIGHT =
	(Math.max(...PROJECTED_UP) - Math.min(...PROJECTED_UP)) *
	HALF *
	CAMERA.margin;
const VIEW_TARGET: Triple = [
	VIEW_RIGHT[0] * VIEW_CENTER_RIGHT + VIEW_UP[0] * VIEW_CENTER_UP,
	VIEW_RIGHT[1] * VIEW_CENTER_RIGHT + VIEW_UP[1] * VIEW_CENTER_UP,
	VIEW_RIGHT[2] * VIEW_CENTER_RIGHT + VIEW_UP[2] * VIEW_CENTER_UP,
];

function vec3(value: Triple) {
	return `vec3(${value.map(f).join(', ')})`;
}

function placeBox({ center, half }: Box, material: number) {
	return `place(sdBox(p, ${vec3(center)}, ${vec3(half)}), ${f(material)}, ${vec3(center)}, ${vec3(half)}, nearest);`;
}

const HALF_ROOM = ROOM.size * HALF;
const HALF_WALL = ROOM.wallThickness * HALF;
const WALL_BOTTOM = -ROOM.slabThickness;
const WALL_HALF_HEIGHT = (ROOM.height - WALL_BOTTOM) * HALF;
const WALL_CENTER_Y = WALL_BOTTOM + WALL_HALF_HEIGHT;
const WALL_HALF_LENGTH = HALF_ROOM + HALF_WALL;
const WALL_CENTER = HALF_ROOM - HALF_WALL;

const FLOOR_SLAB: Box = {
	center: [HALF_ROOM, -ROOM.slabThickness * HALF, HALF_ROOM],
	half: [HALF_ROOM, ROOM.slabThickness * HALF, HALF_ROOM],
};
const LEFT_WALL: Box = {
	center: [-HALF_WALL, WALL_CENTER_Y, WALL_CENTER],
	half: [HALF_WALL, WALL_HALF_HEIGHT, WALL_HALF_LENGTH],
};
const BACK_WALL: Box = {
	center: [WALL_CENTER, WALL_CENTER_Y, -HALF_WALL],
	half: [WALL_HALF_LENGTH, WALL_HALF_HEIGHT, HALF_WALL],
};
const MULLIONS: readonly Box[] = [
	{
		center: [WINDOW.center[0], WINDOW.center[1], 0],
		half: [WINDOW.mullionHalfWidth, WINDOW.half[1], WINDOW.mullionDepth],
	},
	{
		center: [WINDOW.center[0], WINDOW.center[1], 0],
		half: [WINDOW.half[0], WINDOW.mullionHalfWidth, WINDOW.mullionDepth],
	},
];

const LEG_HALF_HEIGHT = DESK.top.center[1] * HALF;
const DESK_LEGS: readonly Box[] = [
	DESK.top.center[0] - DESK.top.half[0] + DESK.legInset,
	DESK.top.center[0] + DESK.top.half[0] - DESK.legInset,
].flatMap((x) =>
	[
		DESK.top.center[2] - DESK.top.half[2] + DESK.legInset,
		DESK.top.center[2] + DESK.top.half[2] - DESK.legInset,
	].map(
		(z): Box => ({
			center: [x, LEG_HALF_HEIGHT, z],
			half: [DESK.legHalfWidth, LEG_HALF_HEIGHT, DESK.legHalfWidth],
		})
	)
);

const STAND_HALF_HEIGHT =
	(MONITOR.center[1] - MONITOR.half[1] - DESK.top.center[1]) * HALF;
const MONITOR_STAND: Box = {
	center: [
		MONITOR.center[0],
		DESK.top.center[1] + STAND_HALF_HEIGHT,
		MONITOR.center[2],
	],
	half: [MONITOR.standHalfWidth, STAND_HALF_HEIGHT, MONITOR.standHalfWidth],
};

const LED_X =
	MACHINE.center[0] -
	MACHINE.half[0] +
	MACHINE.ledInsetX +
	MACHINE.ledHalfWidth;
const BAY_HALF_WIDTH = MACHINE.half[0] - MACHINE.bayInsetX;

const sceneBoxes = [
	placeBox(FLOOR_SLAB, Material.FLOOR),
	placeBox(LEFT_WALL, Material.LEFT_WALL),
	...MULLIONS.map((box) => placeBox(box, Material.FRAME)),
	placeBox(WINDOW.sill, Material.FRAME),
	placeBox(DESK.top, Material.DESK),
	...DESK_LEGS.map((box) => placeBox(box, Material.DESK)),
	placeBox(MONITOR, Material.MONITOR),
	placeBox(MONITOR_STAND, Material.MONITOR),
	placeBox(KEYBOARD, Material.KEYBOARD),
	placeBox(LAMP.base, Material.LAMP_METAL),
	placeBox(LAMP.post, Material.LAMP_METAL),
	placeBox(LAMP.shade, Material.LAMP_SHADE),
	placeBox(CHAIR.seat, Material.CHAIR),
	placeBox(CHAIR.back, Material.CHAIR),
	placeBox(CHAIR.post, Material.LAMP_METAL),
	placeBox(CHAIR.base, Material.LAMP_METAL),
	placeBox(RUG, Material.RUG),
	placeBox(SHELF.board, Material.SHELF),
	...SHELF.items.map((box) => placeBox(box, Material.BOOK)),
	placeBox(PLANT.pot, Material.POT),
	placeBox(MACHINE, Material.MACHINE),
	placeBox(CABLE.floor, Material.CABLE),
	placeBox(CABLE.riser, Material.CABLE),
	placeBox(CABLE.port, Material.PORT),
].join('\n\t');

const leaves = PLANT.leaves
	.map(
		({ center, radius }) =>
			`place(length(p - ${vec3(center)}) - ${f(radius)}, ${f(Material.LEAVES)}, vec3(0.0), vec3(${f(NO_EDGE)}), nearest);`
	)
	.join('\n\t');

const rowChecks = MACHINE.ledRows
	.map(
		(height, index) =>
			`if (abs(y - ${f(height)}) < halfHeight) return ${f(index)};`
	)
	.join('\n\t');

const baseLevels = BASE_LEVELS.map(
	([material, level]) => `if (material == ${f(material)}) return ${f(level)};`
).join('\n\t');

export const nightShiftFragmentShader = /* glsl */ `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_frame;
uniform float u_power;
uniform float u_rows;
uniform float u_screen;
uniform float u_link;
uniform float u_work;
uniform vec3 u_background;
uniform vec3 u_ink;
uniform vec3 u_night;
uniform vec3 u_nightBright;
uniform vec3 u_brand;
uniform vec3 u_brandBright;
uniform vec3 u_paper;
uniform vec3 u_light;

${HASH_GLSL}
${SIMPLEX_NOISE_GLSL}
${BAYER_GLSL}

vec3 g_center;
vec3 g_extent;

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

float sdBox(vec3 p, vec3 center, vec3 extent) {
	vec3 q = abs(p - center) - extent;
	return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

void place(float distance, float material, vec3 center, vec3 extent, inout vec2 nearest) {
	if (distance < nearest.x) {
		nearest = vec2(distance, material);
		g_center = center;
		g_extent = extent;
	}
}

bool inWindow(vec2 xy) {
	return abs(xy.x - ${f(WINDOW.center[0])}) < ${f(WINDOW.half[0])} &&
		abs(xy.y - ${f(WINDOW.center[1])}) < ${f(WINDOW.half[1])};
}

vec2 scene(vec3 p) {
	vec2 nearest = vec2(${f(MARCH.maxDistance)}, 0.0);
	float backWall = max(
		sdBox(p, ${vec3(BACK_WALL.center)}, ${vec3(BACK_WALL.half)}),
		-sdBox(p, ${vec3(WINDOW.center)}, ${vec3(WINDOW.half)})
	);
	place(backWall, ${f(Material.BACK_WALL)}, ${vec3(BACK_WALL.center)}, ${vec3(BACK_WALL.half)}, nearest);
	${sceneBoxes}
	${leaves}
	return nearest;
}

vec3 sceneNormal(vec3 p) {
	vec2 k = vec2(1.0, -1.0) * ${f(MARCH.normalOffset)};
	return normalize(
		k.xyy * scene(p + k.xyy).x + k.yyx * scene(p + k.yyx).x +
		k.yxy * scene(p + k.yxy).x + k.xxx * scene(p + k.xxx).x
	);
}

float boxEdge(vec3 p) {
	if (g_extent.x < 0.0) return 0.0;
	vec3 across = step(vec3(${f(SHADING.edgeBevel)}), abs(p - g_center) / g_extent);
	return step(${f(EDGE_AXES)}, across.x + across.y + across.z);
}

float rowAt(float y, float halfHeight) {
	${rowChecks}
	return -1.0;
}

float rowShare(float row) {
	return clamp(u_rows - row, 0.0, 1.0);
}

float baseLevel(float material) {
	${baseLevels}
	return 0.0;
}

vec3 skyColor(vec3 origin, vec3 ray, float threshold) {
	vec3 q = origin + ray * ((${f(SKY.planeZ)} - origin.z) / ray.z);
	if (!inWindow(q.xy)) return u_background;
	float hill = ${f(SKY.hillBase)} + ${f(SKY.hillAmplitude)} * sin(q.x * ${f(SKY.hillFrequency)}) +
		${f(SKY.hillAmplitude * SKY.hillHarmonicAmplitude)} * sin(q.x * ${f(SKY.hillFrequency * SKY.hillHarmonicFrequency)} + ${f(SKY.hillHarmonicPhase)});
	float river = hill - ${f(SKY.hillAmplitude * SKY.riverDepth)};
	if (q.y < hill) {
		bool glint = abs(q.y - river) < ${f(SKY.riverHeight)} &&
			hash(floor(q.xy * ${f(SKY.starDensity * SKY.glintDensity)}) + floor(u_time * ${f(SKY.glintRate)})) > ${f(SKY.glintChance)};
		return glint ? u_brand : u_ink;
	}
	vec2 toMoon = q.xy - vec2(${f(MOON.position[0])}, ${f(MOON.position[1])});
	float moon = 1.0 - smoothstep(${f(MOON.radius * MOON.softEdge)}, ${f(MOON.radius)}, length(toMoon));
	if (threshold < moon) return u_paper;
	vec2 star = floor(q.xy * ${f(SKY.starDensity)});
	float twinkle = hash(star + floor(u_time * ${f(SKY.twinkleRate)} + hash(star) * ${f(SKY.twinkleSpread)}));
	if (hash(star) > ${f(SKY.starChance)} && twinkle > ${f(SKY.twinkleOn)}) return u_brandBright;
	return dithered(${f(SKY.gradientBase)} + (q.y - ${f(WINDOW.center[1])}) * ${f(SKY.gradientSlope)}, threshold);
}

float pointLight(vec3 p, vec3 n, vec3 light, float strength, float falloff) {
	vec3 toLight = light - p;
	float lambert = max(dot(n, normalize(toLight)), 0.0) * ${f(SHADING.direct)} + ${f(SHADING.ambient)};
	return strength * lambert / (1.0 + falloff * dot(toLight, toLight));
}

float surfaceLevel(vec3 p, vec3 n, float material, float glow, float edge) {
	float level = baseLevel(material) + edge * ${f(DITHER_STYLE.edgeLift)};
	if (n.y > ${f(SHADING.facing)}) level += ${f(SHADING.faceTop)};
	else if (n.z > ${f(SHADING.facing)}) level += ${f(SHADING.faceFront)};
	if (material == ${f(Material.FLOOR)}) {
		if (p.y < -${f(MARCH.epsilon * 2)}) level = ${f(SHADING.slab)} + edge * ${f(DITHER_STYLE.edgeLift)};
		else if (fract(p.x / ${f(ROOM.boardWidth)}) < ${f(ROOM.boardSeam / ROOM.boardWidth)}) level -= ${f(SHADING.faceTop)};
	}
	if ((material == ${f(Material.BACK_WALL)} || material == ${f(Material.LEFT_WALL)}) && p.y > 0.0 && p.y < ${f(ROOM.skirting)}) {
		level += ${f(SHADING.faceTop)};
	}
	if (material == ${f(Material.RUG)}) {
		vec2 rug = abs(p.xz - ${vec3(RUG.center)}.xz) / ${vec3(RUG.half)}.xz;
		if (max(rug.x, rug.y) > ${f(RUG.border)}) level += ${f(RUG.borderLift)};
	}
	if (material == ${f(Material.MACHINE)}) {
		level += glow * ${f(SHADING.machineWake)};
		if (n.x > ${f(SHADING.facing)} && p.y < ${f(MACHINE.ventTop)} && fract(p.y / ${f(MACHINE.ventPitch)}) < ${f(MACHINE.ventDuty)}) {
			level -= ${f(MACHINE.ventDim)};
		}
	}

	vec3 moonward = -normalize(${vec3(MOON.direction)});
	level += ${f(MOON.ambient)} * (0.5 + 0.5 * dot(n, moonward));
	float back = p.z / -moonward.z;
	vec3 throughWindow = p + moonward * back;
	if (back > 0.0 && inWindow(throughWindow.xy)) level += ${f(MOON.patchLevel)} * max(dot(n, moonward), 0.0);

	if (material != ${f(Material.LAMP_SHADE)}) {
		level += pointLight(p, n, ${vec3(LAMP.light)}, ${f(LAMP.strength)}, ${f(LAMP.falloff)});
	}
	if (material != ${f(Material.MONITOR)}) {
		level += u_screen * pointLight(p, n, ${vec3(MONITOR.light)}, ${f(MONITOR.lightStrength)}, ${f(MONITOR.lightFalloff)});
	}
	if (material != ${f(Material.MACHINE)}) {
		level += glow * pointLight(p, n, ${vec3(MACHINE.center)} + ${vec3(SHADING.machineOffset)}, ${f(SHADING.machineLight)}, ${f(SHADING.machineFalloff)});
	}
	return level;
}

void main() {
	vec2 pixel = floor(gl_FragCoord.xy);
	vec2 uv = (pixel + 0.5) / u_resolution;
	float threshold = bayer4(pixel) + ${f(BAYER_CELL_OFFSET)};
	vec2 local = (uv - u_frame.xy) / u_frame.zw;
	float frameAspect = (u_frame.z * u_resolution.x) / (u_frame.w * u_resolution.y);

	float ragged = snoise(local * vec2(frameAspect, 1.0) * ${f(FADE.noiseScale)}) * ${f(FADE.noiseAmount)};
	float frameFade = 1.0 - smoothstep(${f(FADE.inner)}, ${f(FADE.outer)}, length(local) + ragged);
	frameFade *= smoothstep(0.0, ${f(FADE.guard)}, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
	if (!(threshold < frameFade)) {
		gl_FragColor = vec4(u_background, 1.0);
		return;
	}

	float halfHeight = max(${f(VIEW_HALF_HEIGHT)}, ${f(VIEW_HALF_WIDTH)} / frameAspect);
	float glow = u_power * mix(${f(SHADING.idleGlow)}, 1.0, u_work);

	vec3 ray = normalize(${vec3(CAMERA.direction)});
	vec3 right = normalize(cross(ray, vec3(0.0, 1.0, 0.0)));
	vec3 up = cross(right, ray);
	vec3 target = ${vec3(VIEW_TARGET)};
	vec2 view = local * vec2(frameAspect, 1.0) * halfHeight;
	vec3 origin = target - ray * ${f(CAMERA.distance)} + right * view.x + up * view.y;

	float t = 0.0;
	vec2 hit = vec2(${f(MARCH.maxDistance)}, 0.0);
	for (int index = 0; index < ${MARCH.steps}; index++) {
		vec2 probe = scene(origin + ray * t);
		if (probe.x < ${f(MARCH.epsilon)}) {
			hit = vec2(t, probe.y);
			break;
		}
		t += probe.x;
		if (t > ${f(MARCH.maxDistance)}) break;
	}
	bool surface = hit.y > 0.0;

	vec3 color;
	if (surface) {
		vec3 p = origin + ray * hit.x;
		vec3 n = sceneNormal(p);
		scene(p);
		float edge = boxEdge(p);
		float material = hit.y;
		float level = surfaceLevel(p, n, material, glow, edge);
		bool front = n.z > ${f(SHADING.facing)};
		float bay = -1.0;
		if (material == ${f(Material.MACHINE)} && front && abs(p.x - ${f(MACHINE.center[0])}) < ${f(BAY_HALF_WIDTH)}) {
			bay = rowAt(p.y, ${f(MACHINE.bayHalfHeight)});
			if (bay >= 0.0) level += rowShare(bay) * u_power * ${f(SHADING.bayLift)};
		}
		color = dithered(min(level, ${f(SHADING.maxLevel)}), threshold);
		if (bay >= 0.0 && abs(p.x - ${f(LED_X)}) < ${f(MACHINE.ledHalfWidth)}) {
			float ledRow = rowAt(p.y, ${f(MACHINE.ledHalfHeight)});
			if (ledRow >= 0.0) {
				bool lit = threshold < rowShare(ledRow) * u_power;
				bool busy = hash(vec2(ledRow, floor(u_time * ${f(SHADING.busyRate)}))) > ${f(SHADING.busyChance)};
				bool status = ledRow == ${f(MACHINE.statusRow)};
				vec3 ledColor = (status || (busy && threshold < u_work)) ? u_light : u_paper;
				color = lit ? ledColor : u_ink;
			}
		}
		if (material == ${f(Material.MONITOR)} && front) {
			vec2 screen = abs(p.xy - ${vec3(MONITOR.center)}.xy) / ${vec3(MONITOR.half)}.xy;
			if (max(screen.x, screen.y) < ${f(MONITOR.screenInset)}) {
				float scan = step(0.5, fract(p.y * ${f(SHADING.scanDensity)} - u_time * ${f(SHADING.scanSpeed)})) * ${f(SHADING.scanDim)};
				color = dithered(mix(${f(SHADING.screenOff)}, ${f(SHADING.screenLevel)} - scan, u_screen), threshold);
			}
		}
		if (material == ${f(Material.CABLE)} || material == ${f(Material.PORT)}) {
			float along = ${f(CABLE.start)} - p.x + p.y;
			float pulse = fract(u_time * ${f(CABLE.pulseRate)} - along / ${f(CABLE.pulseLength)});
			float flow = max(u_link, u_work) * u_power;
			bool lit = material == ${f(Material.PORT)}
				? threshold < flow * ${f(CABLE.portShare)}
				: pulse < ${f(CABLE.pulseWidth / CABLE.pulseLength)} && threshold < flow;
			if (lit) color = u_light;
		}
	} else {
		color = skyColor(origin, ray, threshold);
		if (color == u_background) {
			float haze = ${f(FADE.glowStrength)} * exp(-${f(FADE.glowFalloff)} * dot(local, local)) * u_power + ragged;
			color = threshold < haze * frameFade ? u_night : u_background;
		}
	}

	float cell = halfHeight / (u_frame.w * u_resolution.y);
	for (int index = 0; index < ${SPARKS.count}; index++) {
		float along = fract(u_time / ${f(SPARKS.secondsPerTrip)} + float(index) / ${f(SPARKS.count)});
		vec3 spark = mix(${vec3(SPARKS.start)}, ${vec3(SPARKS.end)}, along) +
			vec3(0.0, ${f(SPARKS.arc)} * sin(${f(Math.PI)} * along), 0.0);
		vec3 relative = spark - target;
		vec2 offset = abs(view - vec2(dot(relative, right), dot(relative, up)));
		float depth = dot(spark - origin, ray);
		bool hidden = surface && (depth > hit.x + ${f(SPARKS.depthBias)} || spark.z < 0.0);
		bool covered = max(offset.x, offset.y) < ${f(SPARKS.halfCells)} * cell;
		if (covered && !hidden && threshold < u_work * (1.0 - along * ${f(SPARKS.fade)})) {
			color = along >= ${f(SPARKS.colorSwitch)} ? u_light : u_paper;
		}
	}

	gl_FragColor = vec4(color, 1.0);
}
`;
