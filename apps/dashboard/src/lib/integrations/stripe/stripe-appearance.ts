/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AppearanceOptions, CustomFontSource } from '@stripe/connect-js';
import type { Appearance } from '@stripe/stripe-js';
import instrumentSansDataUrl from '#lib/assets/fonts/InstrumentSans-latin.woff2?inline';

const FONT = {
	family: 'Instrument Sans',
	weights: '400 700',
	normalWeight: '400',
	letterSpacing: '0.28px',
} as const;

const TEXT_SIZE = {
	micro: '11px',
	caption: '12px',
	small: '13px',
	body: '14px',
	large: '16px',
	heading: '18px',
} as const;

const GEOMETRY = {
	chipRadius: '8px',
	badgeRadius: '6px',
	overlayRadius: '12px',
	chipPaddingX: '8px',
	chipPaddingY: '5px',
	chipLineHeight: '18px',
	tabPadding: '6px 8px',
	badgePaddingX: '7px',
	badgePaddingY: '1px',
	labelGap: '9px',
	spacingUnit: '8px',
	gridRowSpacing: '16px',
	gridColumnSpacing: '12px',
	borderWidth: '1px',
} as const;

const MODAL_BACKDROP_COLOR = 'rgba(0, 0, 0, 0.1)';

const TOKEN = {
	background: '--bg',
	offset: '--surface-2',
	field: '--surface-4',
	neutralBadge: '--surface-5',
	selected: '--surface-6',
	border: '--border',
	primary: '--brand-accent',
	onPrimary: '--text-on-brand',
	link: '--badge-purple-text',
	text: '--text-primary',
	value: '--text-body',
	muted: '--text-muted',
	danger: '--text-error',
	success: '--text-success',
	warning: '--badge-amber-text',
	errorBadge: '--badge-error-bg',
	successBadge: '--badge-success-bg',
	warningBadge: '--badge-amber-bg',
} as const;

type ThemeToken = (typeof TOKEN)[keyof typeof TOKEN];

const HEX_RADIX = 16;
const HEX_CHANNEL_WIDTH = 2;

function hexChannel(value: number): string {
	return value.toString(HEX_RADIX).padStart(HEX_CHANNEL_WIDTH, '0');
}

class ThemeColors {
	readonly #styles = getComputedStyle(document.documentElement);
	readonly #context = document
		.createElement('canvas')
		.getContext('2d', { willReadFrequently: true });

	resolve(token: ThemeToken, surface: ThemeToken = TOKEN.background): string {
		const value = this.#styles.getPropertyValue(token).trim();
		const context = this.#context;
		if (!context || !value) return value;
		context.globalCompositeOperation = 'copy';
		context.fillStyle = this.#styles.getPropertyValue(surface).trim();
		context.fillRect(0, 0, 1, 1);
		context.globalCompositeOperation = 'source-over';
		context.fillStyle = value;
		context.fillRect(0, 0, 1, 1);
		const [red = 0, green = 0, blue = 0] = context.getImageData(
			0,
			0,
			1,
			1
		).data;
		return `#${hexChannel(red)}${hexChannel(green)}${hexChannel(blue)}`;
	}

	border(surface: ThemeToken = TOKEN.background): string {
		return `${GEOMETRY.borderWidth} solid ${this.resolve(TOKEN.border, surface)}`;
	}
}

export function dashboardConnectFonts(): CustomFontSource[] {
	return [
		{
			family: FONT.family,
			src: `url(${instrumentSansDataUrl})`,
			weight: FONT.weights,
		},
	];
}

export function dashboardElementsAppearance(): Appearance {
	const colors = new ThemeColors();
	const fieldBorder = colors.border(TOKEN.field);
	const chipInput = {
		border: fieldBorder,
		boxShadow: 'none',
		padding: `${GEOMETRY.chipPaddingY} ${GEOMETRY.chipPaddingX}`,
		lineHeight: GEOMETRY.chipLineHeight,
		fontSize: TEXT_SIZE.body,
		letterSpacing: FONT.letterSpacing,
	};
	return {
		theme: 'night',
		labels: 'above',
		variables: {
			fontFamily: FONT.family,
			fontSizeBase: TEXT_SIZE.body,
			fontWeightNormal: FONT.normalWeight,
			borderRadius: GEOMETRY.chipRadius,
			spacingUnit: GEOMETRY.spacingUnit,
			gridRowSpacing: GEOMETRY.gridRowSpacing,
			gridColumnSpacing: GEOMETRY.gridColumnSpacing,
			colorPrimary: colors.resolve(TOKEN.primary),
			colorBackground: colors.resolve(TOKEN.field),
			colorText: colors.resolve(TOKEN.value, TOKEN.field),
			colorTextSecondary: colors.resolve(TOKEN.muted),
			colorTextPlaceholder: colors.resolve(TOKEN.muted, TOKEN.field),
			colorIconTab: colors.resolve(TOKEN.muted, TOKEN.field),
			colorIconTabSelected: colors.resolve(TOKEN.text, TOKEN.selected),
			colorDanger: colors.resolve(TOKEN.danger),
			colorSuccess: colors.resolve(TOKEN.success),
			colorWarning: colors.resolve(TOKEN.warning),
		},
		rules: {
			'.Input': chipInput,
			'.Input:focus': chipInput,
			'.Input--invalid': {
				...chipInput,
				border: `${GEOMETRY.borderWidth} solid ${colors.resolve(TOKEN.danger)}`,
			},
			'.Label': {
				fontSize: TEXT_SIZE.small,
				fontWeight: FONT.normalWeight,
				color: colors.resolve(TOKEN.muted),
				marginBottom: GEOMETRY.labelGap,
				letterSpacing: FONT.letterSpacing,
			},
			'.Error': { fontSize: TEXT_SIZE.caption },
			'.Tab': {
				border: fieldBorder,
				boxShadow: 'none',
				padding: GEOMETRY.tabPadding,
			},
			'.Tab--selected': {
				border: colors.border(TOKEN.selected),
				backgroundColor: colors.resolve(TOKEN.selected),
				boxShadow: 'none',
			},
			'.TabLabel': { fontWeight: FONT.normalWeight },
			'.CheckboxLabel': {
				fontSize: TEXT_SIZE.small,
				color: colors.resolve(TOKEN.value),
			},
			'.CheckboxInput': { border: fieldBorder, boxShadow: 'none' },
		},
	};
}

export function dashboardConnectAppearance(): AppearanceOptions {
	const colors = new ThemeColors();
	const border = colors.resolve(TOKEN.border);
	return {
		overlays: 'dialog',
		variables: {
			fontFamily: FONT.family,
			fontSizeBase: TEXT_SIZE.body,
			spacingUnit: GEOMETRY.spacingUnit,
			borderRadius: GEOMETRY.chipRadius,
			buttonBorderRadius: GEOMETRY.chipRadius,
			formBorderRadius: GEOMETRY.chipRadius,
			badgeBorderRadius: GEOMETRY.badgeRadius,
			overlayBorderRadius: GEOMETRY.overlayRadius,
			buttonPaddingX: GEOMETRY.chipPaddingX,
			buttonPaddingY: GEOMETRY.chipPaddingY,
			inputFieldPaddingX: GEOMETRY.chipPaddingX,
			inputFieldPaddingY: GEOMETRY.chipPaddingY,
			badgePaddingX: GEOMETRY.badgePaddingX,
			badgePaddingY: GEOMETRY.badgePaddingY,
			bodyMdFontSize: TEXT_SIZE.body,
			bodyMdFontWeight: FONT.normalWeight,
			bodySmFontSize: TEXT_SIZE.small,
			bodySmFontWeight: FONT.normalWeight,
			labelMdFontSize: TEXT_SIZE.small,
			labelMdFontWeight: FONT.normalWeight,
			labelSmFontSize: TEXT_SIZE.caption,
			labelSmFontWeight: FONT.normalWeight,
			headingXlFontSize: TEXT_SIZE.heading,
			headingXlFontWeight: FONT.normalWeight,
			headingLgFontSize: TEXT_SIZE.large,
			headingLgFontWeight: FONT.normalWeight,
			headingMdFontSize: TEXT_SIZE.body,
			headingMdFontWeight: FONT.normalWeight,
			headingSmFontSize: TEXT_SIZE.body,
			headingSmFontWeight: FONT.normalWeight,
			headingXsFontSize: TEXT_SIZE.small,
			headingXsFontWeight: FONT.normalWeight,
			buttonLabelFontSize: TEXT_SIZE.body,
			buttonLabelFontWeight: FONT.normalWeight,
			badgeLabelFontSize: TEXT_SIZE.micro,
			badgeLabelFontWeight: FONT.normalWeight,
			colorPrimary: colors.resolve(TOKEN.primary),
			colorBackground: colors.resolve(TOKEN.background),
			colorText: colors.resolve(TOKEN.text),
			colorSecondaryText: colors.resolve(TOKEN.muted),
			colorBorder: border,
			colorDanger: colors.resolve(TOKEN.danger),
			actionPrimaryColorText: colors.resolve(TOKEN.link),
			actionSecondaryColorText: colors.resolve(TOKEN.value),
			buttonPrimaryColorBackground: colors.resolve(TOKEN.primary),
			buttonPrimaryColorBorder: colors.resolve(TOKEN.primary),
			buttonPrimaryColorText: colors.resolve(TOKEN.onPrimary),
			buttonSecondaryColorBackground: colors.resolve(TOKEN.field),
			buttonSecondaryColorBorder: colors.resolve(TOKEN.border, TOKEN.field),
			buttonSecondaryColorText: colors.resolve(TOKEN.text),
			offsetBackgroundColor: colors.resolve(TOKEN.offset),
			formBackgroundColor: colors.resolve(TOKEN.field),
			formHighlightColorBorder: colors.resolve(TOKEN.muted, TOKEN.field),
			badgeNeutralColorBackground: colors.resolve(TOKEN.neutralBadge),
			badgeNeutralColorBorder: colors.resolve(TOKEN.neutralBadge),
			badgeNeutralColorText: colors.resolve(TOKEN.value, TOKEN.neutralBadge),
			badgeSuccessColorBackground: colors.resolve(TOKEN.successBadge),
			badgeSuccessColorBorder: colors.resolve(TOKEN.successBadge),
			badgeSuccessColorText: colors.resolve(TOKEN.success),
			badgeWarningColorBackground: colors.resolve(TOKEN.warningBadge),
			badgeWarningColorBorder: colors.resolve(TOKEN.warningBadge),
			badgeWarningColorText: colors.resolve(TOKEN.warning),
			badgeDangerColorBackground: colors.resolve(TOKEN.errorBadge),
			badgeDangerColorBorder: colors.resolve(TOKEN.errorBadge),
			badgeDangerColorText: colors.resolve(TOKEN.danger),
			overlayBackdropColor: MODAL_BACKDROP_COLOR,
		},
	};
}
