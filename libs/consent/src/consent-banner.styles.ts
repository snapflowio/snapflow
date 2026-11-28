/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export const CONSENT_BANNER_STYLES = `
:host {
	--consent-bg: #0f0f0f;
	--consent-border: #2a2a29;
	--consent-shadow: rgb(0 0 0 / 50%);
	--consent-text: rgb(240 237 230 / 75%);
	--consent-text-strong: #f0ede6;
	--consent-text-muted: rgb(240 237 230 / 55%);
	--consent-choice: rgb(240 237 230 / 10%);
	--consent-choice-hover: rgb(240 237 230 / 20%);
	--consent-choice-focus: rgb(240 237 230 / 26%);
	--consent-cookie-1: #160a33;
	--consent-cookie-2: #36196b;
	--consent-cookie-3: #9b5de5;
	--consent-cookie-4: #c7a5f4;
	--consent-cookie-5: #f0ede6;
	--consent-cookie-chip: #050208;
	--consent-chamfer: 8px;
	--consent-border-width: 1px;
	--consent-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Cfilter id='g' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.4' numOctaves='4' stitchTiles='stitch' seed='0'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1 0 0 0 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");

	position: fixed;
	z-index: 2147483000;
	inset-inline-start: 16px;
	inset-block-end: 16px;
	width: min(420px, calc(100vw - 32px));
	color-scheme: dark;
	font-family: var(--font-sans, "Instrument Sans", system-ui, sans-serif);
}

@media (min-resolution: 2dppx) {
	:host {
		--consent-border-width: 0.5px;
	}
}

*,
*::before,
*::after {
	box-sizing: border-box;
}

.banner {
	position: relative;
	display: grid;
	grid-template-columns: 72px minmax(0, 1fr);
	gap: 16px;
	overflow: hidden;
	padding: 16px;
	border: var(--consent-border-width) solid var(--consent-border);
	border-radius: 12px;
	background: var(--consent-bg);
	box-shadow: 0 10px 30px var(--consent-shadow);
	color: var(--consent-text);
	animation: consent-enter 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.banner::after {
	content: "";
	position: absolute;
	inset: 0;
	pointer-events: none;
	opacity: 0.08;
	background-image: var(--consent-grain);
	background-size: 512px 512px;
}

.cookie {
	width: 72px;
	height: 72px;
	image-rendering: pixelated;
}

.content {
	min-width: 0;
	transition: opacity 280ms ease;
}

h2 {
	margin: 2px 0 6px;
	color: var(--consent-text-strong);
	font-family: var(--font-heading, Chalet, "Instrument Sans", sans-serif);
	font-size: 18px;
	font-weight: 400;
	line-height: 1.2;
	letter-spacing: -0.01em;
}

p {
	margin: 0;
	font-size: 13px;
	line-height: 1.55;
}

.current {
	margin-top: 8px;
	color: var(--consent-text-muted);
	font-size: 12px;
}

a {
	color: var(--consent-text-strong);
	text-decoration: underline;
	text-decoration-color: var(--consent-text-muted);
	text-underline-offset: 0.2em;
}

a:hover {
	text-decoration-color: var(--consent-text-strong);
}

a:focus-visible {
	outline: 1px solid var(--consent-text-strong);
	outline-offset: 2px;
}

.actions {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 14px;
}

.choice {
	display: inline-flex;
	flex: 1 1 auto;
	align-items: center;
	justify-content: center;
	height: 34px;
	padding: 0 10px;
	border: 0;
	background: var(--consent-choice);
	color: var(--consent-text-strong);
	font-family: var(--font-mono, "Chivo Mono", ui-monospace, monospace);
	font-size: 12.5px;
	font-weight: 700;
	white-space: nowrap;
	cursor: pointer;
	clip-path: polygon(
		var(--consent-chamfer) 0,
		100% 0,
		100% calc(100% - var(--consent-chamfer)),
		calc(100% - var(--consent-chamfer)) 100%,
		0 100%,
		0 var(--consent-chamfer)
	);
	transition: background-color 200ms cubic-bezier(0.25, 1, 0.5, 1);
}

.choice:hover {
	background: var(--consent-choice-hover);
	animation: consent-glitch 300ms ease-in-out;
}

.choice:focus-visible {
	outline: none;
	background: var(--consent-choice-focus);
}

:host([closing]) .banner {
	pointer-events: none;
}

:host([closing]) .content {
	opacity: 0;
}

@media (max-width: 520px) {
	:host {
		inset-inline: 8px;
		inset-block-end: 8px;
		width: auto;
	}

	.banner {
		grid-template-columns: 48px minmax(0, 1fr);
		gap: 12px;
		padding: 14px;
	}

	.cookie {
		width: 48px;
		height: 48px;
	}
}

@media (prefers-reduced-motion: reduce) {
	.banner {
		animation: none;
	}

	.content {
		transition: none;
	}

	.choice:hover {
		animation: none;
	}
}

@keyframes consent-glitch {
	0%,
	100% {
		transform: translate(0);
	}

	12% {
		transform: translate(-1px, 0.5px);
	}

	28% {
		transform: translate(1px, -0.5px);
	}

	45% {
		transform: translate(-0.5px, 0);
	}
}

@keyframes consent-enter {
	from {
		opacity: 0;
		transform: translateY(8px);
	}

	to {
		opacity: 1;
		transform: none;
	}
}
`;
