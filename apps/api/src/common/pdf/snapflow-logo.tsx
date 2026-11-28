/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Path, Rect, Svg } from '@react-pdf/renderer';

const LOGO_VIEW_BOX = '0 0 512 512';
const LOGO_EXTENT = 512;
const LOGO_BACKGROUND = '#131215';
const LOGO_ACCENT = '#9B5DE5';

const LOGO_BARS = [
	'M244.5 118H152.5C133.446 118 118 133.446 118 152.5C118 171.554 133.446 187 152.5 187H244.5C263.554 187 279 171.554 279 152.5C279 133.446 263.554 118 244.5 118Z',
	'M394 152.5C394 133.446 378.554 118 359.5 118C340.446 118 325 133.446 325 152.5V244.5C325 263.554 340.446 279 359.5 279C378.554 279 394 263.554 394 244.5V152.5Z',
	'M359.5 325H267.5C248.446 325 233 340.446 233 359.5C233 378.554 248.446 394 267.5 394H359.5C378.554 394 394 378.554 394 359.5C394 340.446 378.554 325 359.5 325Z',
	'M187 267.5C187 248.446 171.554 233 152.5 233C133.446 233 118 248.446 118 267.5V359.5C118 378.554 133.446 394 152.5 394C171.554 394 187 378.554 187 359.5V267.5Z',
] as const;

export function SnapflowLogo({ size }: { size: number }) {
	return (
		<Svg width={size} height={size} viewBox={LOGO_VIEW_BOX}>
			<Rect width={LOGO_EXTENT} height={LOGO_EXTENT} fill={LOGO_BACKGROUND} />
			{LOGO_BARS.map((bar) => (
				<Path key={bar} d={bar} fill={LOGO_ACCENT} />
			))}
		</Svg>
	);
}
