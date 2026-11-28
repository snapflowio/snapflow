/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const CodePalette = {
	BACKGROUND: '#0d0d0d',
	TEXT: '#cbc9c3',
	TEXT_STRONG: '#f0ede6',
	TEXT_MUTED: '#82807b',
	PRIMARY: '#b385ef',
	PRIMARY_SOFT: '#e2c8ff',
	DANGER: '#ffaaa4',
} as const;

export const SNAPFLOW_CODE_THEME = {
	name: 'snapflow',
	type: 'dark',
	colors: {
		'editor.background': CodePalette.BACKGROUND,
		'editor.foreground': CodePalette.TEXT,
	},
	tokenColors: [
		{
			scope: ['comment', 'punctuation.definition.comment'],
			settings: { foreground: CodePalette.TEXT_MUTED, fontStyle: 'italic' },
		},
		{
			scope: ['punctuation', 'meta.brace', 'keyword.operator'],
			settings: { foreground: CodePalette.TEXT_MUTED },
		},
		{
			scope: ['keyword', 'storage', 'storage.type', 'keyword.control'],
			settings: { foreground: CodePalette.PRIMARY },
		},
		{
			scope: ['string', 'string.quoted', 'punctuation.definition.string'],
			settings: { foreground: CodePalette.PRIMARY_SOFT },
		},
		{
			scope: [
				'support.type.property-name',
				'meta.object-literal.key',
				'variable.other.property',
				'entity.name.tag',
				'entity.name.function',
				'support.function',
			],
			settings: { foreground: CodePalette.TEXT_STRONG },
		},
		{
			scope: ['constant', 'constant.numeric', 'constant.language'],
			settings: { foreground: CodePalette.TEXT_STRONG },
		},
		{
			scope: ['variable.parameter', 'variable.other.constant'],
			settings: { foreground: CodePalette.TEXT },
		},
		{
			scope: ['invalid', 'markup.deleted'],
			settings: { foreground: CodePalette.DANGER },
		},
	],
};
