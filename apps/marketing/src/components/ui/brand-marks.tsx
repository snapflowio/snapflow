/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

type MarkProps = {
	className?: string;
	outline?: boolean;
	strokeWidth?: number;
};

export function SnapflowMark({
	className = 'size-8',
	outline = false,
	strokeWidth = 4,
}: MarkProps) {
	return (
		<svg
			className={className}
			viewBox="0 0 368 368"
			fill={outline ? 'none' : 'currentColor'}
			stroke={outline ? 'currentColor' : undefined}
			strokeWidth={outline ? strokeWidth : undefined}
			aria-hidden="true"
		>
			<path d="M172.5 46H80.5C61.446 46 46 61.446 46 80.5S61.446 115 80.5 115h92c19.054 0 34.5-15.446 34.5-34.5S191.554 46 172.5 46Z" />
			<path d="M322 80.5C322 61.446 306.554 46 287.5 46S253 61.446 253 80.5v92c0 19.054 15.446 34.5 34.5 34.5s34.5-15.446 34.5-34.5v-92Z" />
			<path d="M287.5 253h-92c-19.054 0-34.5 15.446-34.5 34.5s15.446 34.5 34.5 34.5h92c19.054 0 34.5-15.446 34.5-34.5S306.554 253 287.5 253Z" />
			<path d="M115 195.5c0-19.054-15.446-34.5-34.5-34.5S46 176.446 46 195.5v92C46 306.554 61.446 322 80.5 322s34.5-15.446 34.5-34.5v-92Z" />
		</svg>
	);
}
