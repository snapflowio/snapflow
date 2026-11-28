/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { fileURLToPath } from 'node:url';
import { Font } from '@react-pdf/renderer';

export const PDF_FONT_FAMILY = 'Noto Sans';
export const PDF_MONO_FONT_FAMILY = 'Noto Sans Mono';
const PDF_REGULAR_WEIGHT = 400;
export const PDF_BOLD_WEIGHT = 700;

const FONT_FILE = {
	REGULAR: new URL('./fonts/NotoSans-Regular.ttf', import.meta.url),
	BOLD: new URL('./fonts/NotoSans-Bold.ttf', import.meta.url),
	MONO: new URL('./fonts/NotoSansMono-Regular.ttf', import.meta.url),
} as const;

Font.register({
	family: PDF_FONT_FAMILY,
	fonts: [
		{ src: fileURLToPath(FONT_FILE.REGULAR), fontWeight: PDF_REGULAR_WEIGHT },
		{ src: fileURLToPath(FONT_FILE.BOLD), fontWeight: PDF_BOLD_WEIGHT },
	],
});
Font.register({
	family: PDF_MONO_FONT_FAMILY,
	src: fileURLToPath(FONT_FILE.MONO),
});
Font.registerHyphenationCallback((word) => [word]);
