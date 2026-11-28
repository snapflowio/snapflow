/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const VIEW_SIZE = 400;
const CENTER = VIEW_SIZE / 2;
const OUTER_RADIUS = 170;
const INNER_RADIUS = 135;
const TICK_INSET = 12;
const TICK_LENGTH = 42;
const STATIC_OPACITY = 0.2;
const ORBIT_OPACITY = 0.7;
const OUTER_STROKE = 0.5;
const INNER_STROKE = 0.7;
const TICK_STROKE = 0.6;
const ORBIT_STROKE = 1;
const INNER_DASH = '2 9';
const ORBIT_DASH = '35 220';

const TICK_FAR = VIEW_SIZE - TICK_INSET - TICK_LENGTH;
const TICKS = `M${CENTER} ${TICK_INSET}v${TICK_LENGTH}M${CENTER} ${TICK_FAR}v${TICK_LENGTH}M${TICK_INSET} ${CENTER}h${TICK_LENGTH}M${TICK_FAR} ${CENTER}h${TICK_LENGTH}`;

export const COIN_RINGS_INNER_FRACTION = INNER_RADIUS / CENTER;

export function CoinRings() {
	return (
		<svg
			className="pointer-events-none absolute inset-0 size-full"
			viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
			aria-hidden="true"
		>
			<g fill="none" stroke="var(--snapflow-purple)" opacity={STATIC_OPACITY}>
				<circle
					cx={CENTER}
					cy={CENTER}
					r={OUTER_RADIUS}
					strokeWidth={OUTER_STROKE}
				/>
				<circle
					cx={CENTER}
					cy={CENTER}
					r={INNER_RADIUS}
					strokeDasharray={INNER_DASH}
					strokeWidth={INNER_STROKE}
				/>
				<path d={TICKS} strokeWidth={TICK_STROKE} />
			</g>
			<circle
				cx={CENTER}
				cy={CENTER}
				r={OUTER_RADIUS}
				fill="none"
				stroke="var(--snapflow-purple)"
				strokeDasharray={ORBIT_DASH}
				strokeWidth={ORBIT_STROKE}
				className="origin-center animate-[snapflow-spin_22s_linear_infinite] [transform-box:view-box]"
				opacity={ORBIT_OPACITY}
			/>
		</svg>
	);
}
