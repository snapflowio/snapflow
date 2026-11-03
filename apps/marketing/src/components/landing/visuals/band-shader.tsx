/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const vertexShader = `
attribute vec2 a_position;
void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_pixelSize;
uniform float u_speed;
uniform float u_scale;
uniform float u_threshold;
uniform float u_warp;
uniform float u_contrast;
uniform float u_angle;
uniform float u_vignette;
uniform float u_mouseInfluence;
uniform float u_glow;
uniform float u_vertFade;
uniform float u_fadeTop;
uniform float u_fadeBottom;
uniform int u_baseShape;
uniform int u_renderMode;
uniform float u_lineCount;
uniform float u_lineWeight;
uniform vec3 u_fgColor;
uniform vec3 u_bgColor;
uniform int u_ditherType;
uniform int u_octaves;
uniform int u_invert;
uniform vec2 u_mouse;
uniform vec3 u_mouseColor;
uniform float u_mouseRadius;

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

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p) {
	p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
	return fract(sin(p) * 43758.5453);
}

float voronoi(vec2 p, float t) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	float minDist = 1.0;
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 neighbor = vec2(float(x), float(y));
			vec2 point = hash2(i + neighbor);
			point = 0.5 + 0.5 * sin(t * 0.8 + 6.2832 * point);
			vec2 difference = neighbor + point - f;
			minDist = min(minDist, length(difference));
		}
	}
	return minDist;
}

float bayer2(vec2 position) {
	int x = int(mod(position.x, 2.0));
	int y = int(mod(position.y, 2.0));
	int index = x + y * 2;
	if (index == 0) return 0.0 / 4.0;
	if (index == 1) return 2.0 / 4.0;
	if (index == 2) return 3.0 / 4.0;
	if (index == 3) return 1.0 / 4.0;
	return 0.0;
}

float bayer4(vec2 position) {
	int x = int(mod(position.x, 4.0));
	int y = int(mod(position.y, 4.0));
	int index = x + y * 4;
	if (index == 0) return 0.0 / 16.0;
	if (index == 1) return 8.0 / 16.0;
	if (index == 2) return 2.0 / 16.0;
	if (index == 3) return 10.0 / 16.0;
	if (index == 4) return 12.0 / 16.0;
	if (index == 5) return 4.0 / 16.0;
	if (index == 6) return 14.0 / 16.0;
	if (index == 7) return 6.0 / 16.0;
	if (index == 8) return 3.0 / 16.0;
	if (index == 9) return 11.0 / 16.0;
	if (index == 10) return 1.0 / 16.0;
	if (index == 11) return 9.0 / 16.0;
	if (index == 12) return 15.0 / 16.0;
	if (index == 13) return 7.0 / 16.0;
	if (index == 14) return 13.0 / 16.0;
	if (index == 15) return 5.0 / 16.0;
	return 0.0;
}

float bayer8(vec2 position) {
	float b4 = bayer4(position);
	float b2 = bayer2(position * 0.5);
	return b4 * 0.25 + b2 * 0.75;
}

float halftone(vec2 position) {
	vec2 center = mod(position, 4.0) - 2.0;
	return length(center) / 2.828;
}

float lineDither(vec2 position) {
	return fract(position.y * 0.5);
}

float blueNoise(vec2 position) {
	return hash(position);
}

float getDither(vec2 position) {
	if (u_ditherType == 0) return bayer2(position);
	if (u_ditherType == 1) return bayer4(position);
	if (u_ditherType == 2) return bayer8(position);
	if (u_ditherType == 3) return halftone(position);
	if (u_ditherType == 4) return lineDither(position);
	if (u_ditherType == 5) return blueNoise(position);
	return bayer4(position);
}

void main() {
	vec2 pixel = floor(gl_FragCoord.xy / u_pixelSize);
	vec2 uv = pixel * u_pixelSize / u_resolution;
	float radians = u_angle * 3.14159265 / 180.0;
	vec2 flow = vec2(cos(radians), sin(radians));
	float t = u_time * u_speed;

	vec2 mouseUv = u_mouse;
	float mouseDistance = length(uv - mouseUv);
	float mouseEffect = u_mouseInfluence *
		smoothstep(0.4, 0.0, mouseDistance) * 0.5;

	float warpX = snoise(uv * u_scale * 1.5 + flow * t * 0.3) * u_warp;
	float warpY = snoise(
		uv * u_scale * 1.5 + flow.yx * t * 0.3 + vec2(5.2, 1.3)
	) * u_warp;
	vec2 warped = uv + vec2(warpX, warpY);
	vec2 shapePosition = warped * u_scale + flow * t * 0.2;
	float noiseValue;

	if (u_baseShape == 0) {
		noiseValue = snoise(shapePosition);
		float amplitude = 0.5;
		float frequency = 2.0;
		if (u_octaves >= 2) {
			noiseValue += amplitude * snoise(
				shapePosition * frequency + flow * t * -0.15 + vec2(3.7, 8.1)
			);
			amplitude *= 0.5;
			frequency *= 2.0;
		}
		if (u_octaves >= 3) {
			noiseValue += amplitude * snoise(
				shapePosition * frequency + flow * t * 0.1 + vec2(7.3, 2.9)
			);
			amplitude *= 0.5;
			frequency *= 2.0;
		}
		if (u_octaves >= 4) {
			noiseValue += amplitude * snoise(
				shapePosition * frequency + flow * t * -0.08 + vec2(1.1, 5.5)
			);
		}
		noiseValue = noiseValue * 0.5 + 0.5;
	} else if (u_baseShape == 1) {
		noiseValue = voronoi(shapePosition, u_time);
	} else if (u_baseShape == 2) {
		vec2 center = (warped - 0.5) * u_scale;
		noiseValue = fract(length(center) * 3.0 - t * 0.5);
	} else if (u_baseShape == 3) {
		float wave = sin(
			shapePosition.x * 6.2832 + sin(shapePosition.y * 3.0) * 1.5
		);
		noiseValue = wave * 0.5 + 0.5;
	} else if (u_baseShape == 4) {
		vec2 center = (warped - 0.5) * u_scale;
		float angle = atan(center.y, center.x);
		float distance = length(center);
		noiseValue = fract(distance * 2.5 - angle / 6.2832 * 3.0 - t * 0.3);
	} else if (u_baseShape == 5) {
		noiseValue = sin(shapePosition.x * 3.0) +
			sin(shapePosition.y * 3.0) +
			sin((shapePosition.x + shapePosition.y) * 2.0) +
			sin(length(shapePosition) * 3.0);
		noiseValue = noiseValue * 0.125 + 0.5;
	} else if (u_baseShape == 6) {
		vec2 distance = fract(shapePosition) - 0.5;
		noiseValue = 1.0 - (abs(distance.x) + abs(distance.y)) * 2.0;
	} else if (u_baseShape == 7) {
		vec2 center = (warped - 0.5) * u_scale;
		float distance = length(center);
		noiseValue = sin(distance * 12.0 - t * 3.0) * 0.5 + 0.5;
	} else {
		float rowPosition = warped.y * u_lineCount;
		float rowIndex = floor(rowPosition);
		float rowFraction = fract(rowPosition);
		float bandMask = smoothstep(0.0, 0.04, rowFraction) *
			smoothstep(u_lineWeight, u_lineWeight - 0.04, rowFraction);
		float segmentX = warped.x * u_scale * 3.0 + flow.x * t * 0.5;
		float segment = snoise(
			vec2(segmentX, rowIndex * 0.37 + t * 0.05)
		);
		segment += 0.35 * snoise(
			vec2(segmentX * 2.5, rowIndex * 0.71 + 3.3)
		);
		segment = segment * 0.5 + 0.5;
		float rowDensity = snoise(
			vec2(rowIndex * 0.23, t * 0.03 + 5.7)
		) * 0.3 + 0.7;
		noiseValue = bandMask * segment * rowDensity;
	}

	noiseValue += mouseEffect;
	if (u_vignette > 0.0) {
		vec2 vignetteCenter = uv - 0.5;
		float vignetteDistance = length(vignetteCenter) * 2.0;
		float vignetteFade = smoothstep(0.0, 1.0, vignetteDistance);
		noiseValue = mix(
			noiseValue,
			noiseValue * (1.0 - vignetteFade),
			u_vignette
		);
	}
	if (u_fadeTop > 0.0) {
		noiseValue *= smoothstep(
			u_fadeTop,
			u_fadeTop + 0.02,
			1.0 - uv.y
		);
	}
	if (u_fadeBottom > 0.0) {
		noiseValue *= smoothstep(
			u_fadeBottom,
			u_fadeBottom + 0.02,
			uv.y
		);
	}
	if (u_vertFade > 0.0) {
		noiseValue *= mix(1.0, pow(uv.y, 2.0), u_vertFade);
	}

	float preRenderNoise = noiseValue;
	float result;
	if (u_renderMode == 1) {
		float contourValue = fract(noiseValue * u_lineCount);
		float lineDistance = min(contourValue, 1.0 - contourValue) * 2.0;
		float lineMask = 1.0 - smoothstep(
			0.0,
			u_lineWeight,
			lineDistance
		);
		result = step(getDither(pixel), lineMask);
	} else {
		float edge = (1.0 - u_contrast) * 0.8;
		noiseValue = smoothstep(
			u_threshold - edge,
			u_threshold + edge,
			noiseValue
		);
		result = step(getDither(pixel), noiseValue);
	}
	if (u_invert == 1) result = 1.0 - result;

	float mouseColorDistance = length(uv - u_mouse);
	float mouseBlend = smoothstep(
		u_mouseRadius,
		u_mouseRadius * 0.65,
		mouseColorDistance
	);
	vec3 background = mix(u_bgColor, u_mouseColor, mouseBlend);
	vec3 color = mix(background, u_fgColor, result);
	if (u_glow > 0.0) {
		float glowZone;
		if (u_renderMode == 1) {
			float contourValue = fract(preRenderNoise * u_lineCount);
			float lineDistance = min(contourValue, 1.0 - contourValue) * 2.0;
			glowZone = 1.0 - smoothstep(
				0.0,
				u_lineWeight * 4.0,
				lineDistance
			);
		} else {
			float density = abs(preRenderNoise - u_threshold);
			glowZone = smoothstep(0.35, 0.0, density);
		}
		vec3 glowTint = u_fgColor * 1.5 + u_mouseColor * 0.1;
		color += glowTint * glowZone * u_glow * 0.18;
	}
	gl_FragColor = vec4(color, 1.0);
}
`;

const uniformNames = [
	'u_resolution',
	'u_time',
	'u_pixelSize',
	'u_speed',
	'u_scale',
	'u_threshold',
	'u_warp',
	'u_contrast',
	'u_angle',
	'u_vignette',
	'u_fadeTop',
	'u_fadeBottom',
	'u_mouseInfluence',
	'u_glow',
	'u_vertFade',
	'u_baseShape',
	'u_renderMode',
	'u_lineCount',
	'u_lineWeight',
	'u_fgColor',
	'u_bgColor',
	'u_ditherType',
	'u_octaves',
	'u_invert',
	'u_mouse',
	'u_mouseColor',
	'u_mouseRadius',
] as const;

type UniformName = (typeof uniformNames)[number];
type ShaderConfig = {
	baseShape: number;
	ditherType: number;
	pixelSize: number;
	speed: number;
	scale: number;
	threshold: number;
	warp: number;
	contrast: number;
	angle: number;
	vignette: number;
	glow: number;
	octaves: number;
	fadeTop: number;
	fadeBottom: number;
	vertFade: number;
	renderMode: number;
	lineCount: number;
	lineWeight: number;
	invert: number;
	mouseInfluence: number;
	foreground: string;
	background: string;
};

type BandVariant = 'purple' | 'dark';

const variantConfigs: Record<BandVariant, ShaderConfig> = {
	dark: {
		baseShape: 8,
		ditherType: 4,
		pixelSize: 14,
		speed: 0.06,
		scale: 0.4,
		threshold: 0.62,
		warp: 0.12,
		contrast: 0.75,
		angle: 261,
		vignette: 0,
		glow: 0.6,
		octaves: 4,
		fadeTop: 0,
		fadeBottom: 0,
		vertFade: 0.7,
		renderMode: 1,
		lineCount: 17,
		lineWeight: 0.16,
		invert: 0,
		mouseInfluence: 0,
		foreground: '#0A0A0A',
		background: '#121212',
	},
	purple: {
		baseShape: 8,
		ditherType: 4,
		pixelSize: 8,
		speed: 0.25,
		scale: 1.3,
		threshold: 0.11,
		warp: 0.12,
		contrast: 0.75,
		angle: 238,
		vignette: 0,
		glow: 0.6,
		octaves: 4,
		fadeTop: 0,
		fadeBottom: 0,
		vertFade: 0.7,
		renderMode: 1,
		lineCount: 2,
		lineWeight: 0.12,
		invert: 0,
		mouseInfluence: 0,
		foreground: '#000000',
		background: '#9b5de5',
	},
};

const MOUSE_COLOR = '#9B5DE5';
const MOUSE_RADIUS = 0.25;
const NO_MOUSE_POSITION = -1;
const MAX_PIXEL_DENSITY = 2;
const MILLISECONDS_PER_SECOND = 1000;
const VISIBILITY_ROOT_MARGIN = '200px 0px';
const FULLSCREEN_QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const QUAD_VERTEX_COUNT = 4;
const POSITION_COMPONENTS = 2;

type Uniforms = ReadonlyMap<UniformName, WebGLUniformLocation | null>;
type BandProgram = {
	program: WebGLProgram;
	vertex: WebGLShader;
	fragment: WebGLShader;
	buffer: WebGLBuffer;
	uniforms: Uniforms;
};
type PointerPosition = readonly [number, number];
type BandFrame = {
	gl: WebGLRenderingContext;
	canvas: HTMLCanvasElement;
	uniforms: Uniforms;
	config: ShaderConfig;
	foreground: readonly [number, number, number];
	background: readonly [number, number, number];
	mouseColor: readonly [number, number, number];
};

function compileShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string
) {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
	gl.deleteShader(shader);
	return null;
}

function deleteShaders(
	gl: WebGLRenderingContext,
	shaders: readonly (WebGLShader | null)[]
) {
	for (const shader of shaders) gl.deleteShader(shader);
}

function createBandProgram(gl: WebGLRenderingContext): BandProgram | null {
	const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
	const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
	const program = gl.createProgram();
	if (!(vertex && fragment && program)) {
		gl.deleteProgram(program);
		deleteShaders(gl, [vertex, fragment]);
		return null;
	}
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	const buffer = gl.getProgramParameter(program, gl.LINK_STATUS)
		? gl.createBuffer()
		: null;
	if (!buffer) {
		gl.deleteProgram(program);
		deleteShaders(gl, [vertex, fragment]);
		return null;
	}
	gl.useProgram(program);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);
	const position = gl.getAttribLocation(program, 'a_position');
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, POSITION_COMPONENTS, gl.FLOAT, false, 0, 0);
	const uniforms: Uniforms = new Map(
		uniformNames.map((name) => [name, gl.getUniformLocation(program, name)])
	);
	return { program, vertex, fragment, buffer, uniforms };
}

function deleteBandProgram(
	gl: WebGLRenderingContext,
	bandProgram: BandProgram
) {
	gl.deleteBuffer(bandProgram.buffer);
	gl.deleteProgram(bandProgram.program);
	deleteShaders(gl, [bandProgram.vertex, bandProgram.fragment]);
}

function resizeCanvas(canvas: HTMLCanvasElement) {
	const bounds = canvas.parentElement?.getBoundingClientRect();
	if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
	const density = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_DENSITY);
	const width = Math.round(bounds.width * density);
	const height = Math.round(bounds.height * density);
	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}
	return { width, height, density };
}

function drawFrame(
	frame: BandFrame,
	timestamp: number,
	mouse: PointerPosition | null
) {
	const size = resizeCanvas(frame.canvas);
	if (!size) return;
	const { gl, uniforms, config } = frame;
	const location = (name: UniformName) => uniforms.get(name) ?? null;
	gl.viewport(0, 0, size.width, size.height);
	gl.uniform2f(location('u_resolution'), size.width, size.height);
	gl.uniform1f(location('u_time'), timestamp / MILLISECONDS_PER_SECOND);
	gl.uniform1f(location('u_pixelSize'), config.pixelSize * size.density);
	gl.uniform1f(location('u_speed'), config.speed);
	gl.uniform1f(location('u_scale'), config.scale);
	gl.uniform1f(location('u_threshold'), config.threshold);
	gl.uniform1f(location('u_warp'), config.warp);
	gl.uniform1f(location('u_contrast'), config.contrast);
	gl.uniform1f(location('u_angle'), config.angle);
	gl.uniform1f(location('u_vignette'), config.vignette);
	gl.uniform1f(location('u_fadeTop'), config.fadeTop);
	gl.uniform1f(location('u_fadeBottom'), config.fadeBottom);
	gl.uniform1f(location('u_mouseInfluence'), config.mouseInfluence);
	gl.uniform1f(location('u_glow'), config.glow);
	gl.uniform1f(location('u_vertFade'), config.vertFade);
	gl.uniform1i(location('u_baseShape'), config.baseShape);
	gl.uniform1i(location('u_renderMode'), config.renderMode);
	gl.uniform1f(location('u_lineCount'), config.lineCount);
	gl.uniform1f(location('u_lineWeight'), config.lineWeight);
	gl.uniform3fv(location('u_fgColor'), frame.foreground);
	gl.uniform3fv(location('u_bgColor'), frame.background);
	gl.uniform1i(location('u_ditherType'), config.ditherType);
	gl.uniform1i(location('u_octaves'), config.octaves);
	gl.uniform1i(location('u_invert'), config.invert);
	gl.uniform2f(
		location('u_mouse'),
		mouse?.[0] ?? NO_MOUSE_POSITION,
		mouse?.[1] ?? NO_MOUSE_POSITION
	);
	gl.uniform3fv(location('u_mouseColor'), frame.mouseColor);
	gl.uniform1f(location('u_mouseRadius'), MOUSE_RADIUS);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, QUAD_VERTEX_COUNT);
}

function parseHexColor(value: string) {
	return [
		Number.parseInt(value.slice(1, 3), 16) / 255,
		Number.parseInt(value.slice(3, 5), 16) / 255,
		Number.parseInt(value.slice(5, 7), 16) / 255,
	] as const;
}

type PointerTracking = 'parent' | 'section';

function resolvePointerTarget(
	wrapper: HTMLElement,
	section: HTMLElement | null,
	trackPointer: PointerTracking | undefined
) {
	if (trackPointer === 'section') return section;
	if (trackPointer === 'parent') return wrapper.parentElement;
	return null;
}

function observePointer(target: HTMLElement | null) {
	let position: PointerPosition | null = null;
	const move = (event: MouseEvent) => {
		if (!target) return;
		const bounds = target.getBoundingClientRect();
		position = [
			(event.clientX - bounds.left) / bounds.width,
			1 - (event.clientY - bounds.top) / bounds.height,
		];
	};
	const leave = () => {
		position = null;
	};
	target?.addEventListener('mousemove', move);
	target?.addEventListener('mouseleave', leave);
	return {
		current: () => position,
		dispose: () => {
			target?.removeEventListener('mousemove', move);
			target?.removeEventListener('mouseleave', leave);
		},
	};
}

function observeVisibility(section: HTMLElement | null) {
	let visible = true;
	if (!section) return { current: () => visible, dispose: () => undefined };
	const observer = new IntersectionObserver(
		([entry]) => {
			visible = entry?.isIntersecting ?? true;
		},
		{ threshold: 0, rootMargin: VISIBILITY_ROOT_MARGIN }
	);
	observer.observe(section);
	return {
		current: () => visible,
		dispose: () => observer.disconnect(),
	};
}

type BandShaderProps = {
	anchorSelector?: string;
	anchorPadding?: number;
	className?: string;
	contained?: boolean;
	trackPointer?: PointerTracking;
	variant?: BandVariant;
};

export function BandShader({
	anchorSelector,
	anchorPadding = 0,
	className,
	contained = false,
	trackPointer,
	variant = 'purple',
}: BandShaderProps) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [webglUnavailable, setWebglUnavailable] = useState(false);
	const config = variantConfigs[variant];

	useLayoutEffect(() => {
		const wrapper = wrapperRef.current;
		if (!(wrapper && anchorSelector)) return;
		const section = wrapper.closest('section');
		const anchor = section?.querySelector<HTMLElement>(anchorSelector);
		if (!(section && anchor)) return;

		const resize = () => {
			const sectionBounds = section.getBoundingClientRect();
			const anchorBounds = anchor.getBoundingClientRect();
			const halfRem =
				Number.parseFloat(getComputedStyle(document.documentElement).fontSize) *
				0.5;
			const padding = halfRem + anchorPadding;
			wrapper.style.top = `${anchorBounds.top - sectionBounds.top - padding}px`;
			wrapper.style.height = `${anchorBounds.height + padding * 2}px`;
		};

		resize();
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(anchor);
		resizeObserver.observe(section);
		window.addEventListener('resize', resize);
		window.addEventListener('load', resize);
		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', resize);
			window.removeEventListener('load', resize);
		};
	}, [anchorPadding, anchorSelector]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const wrapper = wrapperRef.current;
		if (!(canvas && wrapper)) return;
		const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
		const bandProgram = gl ? createBandProgram(gl) : null;
		if (!(gl && bandProgram)) {
			setWebglUnavailable(true);
			return;
		}

		const section = canvas.closest('section');
		const pointer = observePointer(
			resolvePointerTarget(wrapper, section, trackPointer)
		);
		const visibility = observeVisibility(section);
		const bandFrame: BandFrame = {
			gl,
			canvas,
			uniforms: bandProgram.uniforms,
			config,
			foreground: parseHexColor(config.foreground),
			background: parseHexColor(config.background),
			mouseColor: parseHexColor(MOUSE_COLOR),
		};

		let frame = 0;
		const draw = (timestamp: number) => {
			if (visibility.current()) {
				drawFrame(bandFrame, timestamp, pointer.current());
			}
			frame = requestAnimationFrame(draw);
		};
		frame = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(frame);
			visibility.dispose();
			pointer.dispose();
			deleteBandProgram(gl, bandProgram);
		};
	}, [config, trackPointer]);

	return (
		<div
			ref={wrapperRef}
			className={`pointer-events-none absolute z-0 overflow-hidden ${contained ? 'inset-0' : 'top-0 right-0 left-0 h-0 mix-blend-lighten min-[769px]:right-[5%] min-[769px]:left-[5%] min-[1281px]:right-[calc(50%-600px)] min-[1281px]:left-[calc(50%-600px)]'} ${className ?? ''}`}
			style={
				webglUnavailable ? { backgroundColor: config.background } : undefined
			}
			aria-hidden="true"
		>
			{webglUnavailable ? null : (
				<canvas ref={canvasRef} className="absolute inset-0 z-0 size-full" />
			)}
		</div>
	);
}
