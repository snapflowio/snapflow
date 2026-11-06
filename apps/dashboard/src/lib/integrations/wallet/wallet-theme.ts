/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ThemeMode, ThemeVariables } from '@reown/appkit';

const LIGHT_COLOR_SCHEME = 'light';
const ACCENT_TOKEN = '--brand-accent';
const BACKGROUND_TOKEN = '--bg';
const RADIUS_TOKEN = '--radius';
const MODAL_LAYER_TOKEN = '--z-popover';
const COLOR_MIX_STRENGTH_PERCENT = 20;
const APPKIT_RADIUS_STEPS_PER_DASHBOARD_RADIUS = 2;

function rootStyle(): CSSStyleDeclaration {
	return getComputedStyle(document.documentElement);
}

function token(style: CSSStyleDeclaration, name: string): string {
	const value = style.getPropertyValue(name).trim();
	if (!value) throw new Error(`The theme token ${name} is not defined.`);
	return value;
}

function remToPixels(style: CSSStyleDeclaration, rem: string): number {
	return Number.parseFloat(rem) * Number.parseFloat(style.fontSize);
}

export function walletThemeMode(): ThemeMode {
	return rootStyle().colorScheme === LIGHT_COLOR_SCHEME ? 'light' : 'dark';
}

export function walletThemeVariables(): ThemeVariables {
	const style = rootStyle();
	const radiusPixels =
		remToPixels(style, token(style, RADIUS_TOKEN)) /
		APPKIT_RADIUS_STEPS_PER_DASHBOARD_RADIUS;
	return {
		'--apkt-font-family': getComputedStyle(document.body).fontFamily,
		'--apkt-accent': token(style, ACCENT_TOKEN),
		'--apkt-color-mix': token(style, BACKGROUND_TOKEN),
		'--apkt-color-mix-strength': COLOR_MIX_STRENGTH_PERCENT,
		'--apkt-border-radius-master': `${radiusPixels}px`,
		'--apkt-z-index': Number(token(style, MODAL_LAYER_TOKEN)),
	};
}
