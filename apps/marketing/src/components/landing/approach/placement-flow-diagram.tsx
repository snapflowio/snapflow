/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const PLACEMENT_FLOW_CARD_CLASSES =
	'cursor-default [&_.card-accent]:transition-[fill,stroke] [&_.card-accent]:duration-150 [&_.card-divider]:transition-[fill,stroke] [&_.card-divider]:duration-150 [&_.card-sub]:transition-[fill,stroke] [&_.card-sub]:duration-150 [&_.card-title]:transition-[fill,stroke] [&_.card-title]:duration-150 [&_rect]:transition-[fill,stroke] [&_rect]:duration-150 hover:[&_.card-accent]:fill-snapflow-green hover:[&_.card-accent]:duration-0 hover:[&_.card-divider]:stroke-snapflow-paper/18 hover:[&_.card-divider]:duration-0 hover:[&_.card-sub]:fill-snapflow-paper/50 hover:[&_.card-sub]:duration-0 hover:[&_.card-title]:fill-snapflow-paper hover:[&_.card-title]:duration-0 hover:[&_rect]:fill-snapflow-paper/4 hover:[&_rect]:stroke-snapflow-border hover:[&_rect]:duration-0';

export function PlacementFlowDiagram() {
	return (
		<div className="relative w-full max-w-250">
			<svg
				viewBox="0 0 560 280"
				fill="none"
				className="block w-full contain-[layout_style_paint] transform-[translateZ(0)] will-change-transform"
				aria-label="You pick an independent machine on Snapflow for your workload"
			>
				<defs>
					<linearGradient
						id="snapflow-placement-trail-1"
						x1="0"
						y1="0"
						x2="1"
						y2="0"
					>
						<stop
							offset="0"
							stopColor="var(--snapflow-green)"
							stopOpacity="0"
						/>
						<stop
							offset=".7"
							stopColor="var(--snapflow-green)"
							stopOpacity=".3"
						/>
						<stop
							offset="1"
							stopColor="var(--snapflow-green)"
							stopOpacity=".6"
						/>
					</linearGradient>
					<linearGradient
						id="snapflow-placement-trail-2"
						x1="0"
						y1="0"
						x2="1"
						y2="0"
					>
						<stop
							offset="0"
							stopColor="var(--snapflow-green)"
							stopOpacity="0"
						/>
						<stop
							offset=".7"
							stopColor="var(--snapflow-green)"
							stopOpacity=".3"
						/>
						<stop
							offset="1"
							stopColor="var(--snapflow-green)"
							stopOpacity=".6"
						/>
					</linearGradient>
					<path id="snapflow-workload-path" d="M130 125h63" />
					<path id="snapflow-machine-path" d="M353 125h70" />
					<path id="snapflow-requirements-path" d="M273 38v40" />
					<path id="snapflow-quote-path" d="M273 172v42" />
				</defs>
				<rect
					x="5"
					y="68"
					width="550"
					height="112"
					stroke="color-mix(in srgb, var(--snapflow-paper) 8%, transparent)"
					strokeDasharray="4 4"
				/>
				<rect x="15" y="61" width="96" height="14" fill="var(--snapflow-ink)" />
				<text
					x="20"
					y="71"
					fontFamily="'Chivo Mono', monospace"
					fontSize="6"
					letterSpacing="2"
					fill="color-mix(in srgb, var(--snapflow-paper) 30%, transparent)"
				>
					SNAPFLOW NETWORK
				</text>
				<g className={PLACEMENT_FLOW_CARD_CLASSES}>
					<rect
						x="20"
						y="100"
						width="110"
						height="50"
						fill="color-mix(in srgb, var(--snapflow-ink) 95%, transparent)"
						stroke="color-mix(in srgb, var(--snapflow-paper) 15%, transparent)"
					/>
					<text
						x="75"
						y="121"
						textAnchor="middle"
						dominantBaseline="central"
						fontFamily="'Chivo Mono', monospace"
						fontSize="7"
						letterSpacing="1.5"
						fill="color-mix(in srgb, var(--snapflow-paper) 40%, transparent)"
						className="card-title"
					>
						YOUR WORKLOAD
					</text>
					<text
						x="75"
						y="133"
						textAnchor="middle"
						dominantBaseline="central"
						fontFamily="'Chivo Mono', monospace"
						fontSize="5.5"
						letterSpacing="1"
						fill="color-mix(in srgb, var(--snapflow-paper) 25%, transparent)"
						className="card-sub"
					>
						APP · JOB · DEV ENV
					</text>
				</g>
				<line
					x1="130"
					y1="125"
					x2="193"
					y2="125"
					stroke="color-mix(in srgb, var(--snapflow-green) 15%, transparent)"
					pointerEvents="none"
				/>
				<line
					x1="130"
					y1="125"
					x2="193"
					y2="125"
					stroke="url(#snapflow-placement-trail-1)"
					strokeWidth="2"
					pointerEvents="none"
				>
					<animate
						attributeName="opacity"
						values=".2;.6;.2"
						dur="2s"
						repeatCount="indefinite"
					/>
				</line>
				<rect
					x="-1.5"
					y="-1.5"
					width="3"
					height="3"
					fill="var(--snapflow-green)"
					pointerEvents="none"
				>
					<animateMotion
						dur="2s"
						repeatCount="indefinite"
						keyPoints="0;1"
						keyTimes="0;1"
						calcMode="linear"
					>
						<mpath href="#snapflow-workload-path" />
					</animateMotion>
					<animate
						attributeName="opacity"
						values="0;1;1;0"
						keyTimes="0;.1;.8;1"
						dur="2s"
						repeatCount="indefinite"
					/>
				</rect>
				<g className={PLACEMENT_FLOW_CARD_CLASSES}>
					<rect
						x="193"
						y="78"
						width="160"
						height="94"
						fill="color-mix(in srgb, var(--snapflow-ink) 95%, transparent)"
						stroke="color-mix(in srgb, var(--snapflow-paper) 20%, transparent)"
						strokeWidth="1.5"
					/>
					<text
						x="274.5"
						y="108"
						textAnchor="middle"
						dominantBaseline="central"
						fontFamily="'Chivo Mono', monospace"
						fontSize="10"
						letterSpacing="2.4"
						fill="var(--snapflow-paper)"
						className="card-title"
					>
						SNAPFLOW
					</text>
					<text
						x="273"
						y="124"
						textAnchor="middle"
						dominantBaseline="central"
						fontFamily="'Chivo Mono', monospace"
						fontSize="5.5"
						letterSpacing="1.5"
						fill="var(--snapflow-green)"
						className="card-accent"
					>
						✓ RIGHT MACHINE FOUND
					</text>
					<line
						x1="210"
						y1="145"
						x2="336"
						y2="145"
						stroke="color-mix(in srgb, var(--snapflow-paper) 8%, transparent)"
						strokeWidth=".5"
						className="card-divider"
					/>
					{[
						['RESOURCES', 218],
						['LOCATION', 254],
						['DURATION', 292],
						['HEALTH', 330],
					].map(([label, x]) => (
						<text
							key={label}
							x={x}
							y="160"
							textAnchor="middle"
							fontFamily="'Chivo Mono', monospace"
							fontSize="4.2"
							letterSpacing=".7"
							fill="color-mix(in srgb, var(--snapflow-paper) 25%, transparent)"
							className="card-sub"
						>
							{label}
						</text>
					))}
				</g>
				<line
					x1="353"
					y1="125"
					x2="423"
					y2="125"
					stroke="color-mix(in srgb, var(--snapflow-green) 15%, transparent)"
					pointerEvents="none"
				/>
				<line
					x1="353"
					y1="125"
					x2="423"
					y2="125"
					stroke="url(#snapflow-placement-trail-2)"
					strokeWidth="2"
					pointerEvents="none"
				>
					<animate
						attributeName="opacity"
						values=".2;.6;.2"
						dur="2s"
						begin="1s"
						repeatCount="indefinite"
					/>
				</line>
				<rect
					x="-1.5"
					y="-1.5"
					width="3"
					height="3"
					fill="var(--snapflow-green)"
					pointerEvents="none"
				>
					<animateMotion
						dur="2s"
						begin="1s"
						repeatCount="indefinite"
						keyPoints="0;1"
						keyTimes="0;1"
						calcMode="linear"
					>
						<mpath href="#snapflow-machine-path" />
					</animateMotion>
					<animate
						attributeName="opacity"
						values="0;1;1;0"
						keyTimes="0;.1;.8;1"
						dur="2s"
						begin="1s"
						repeatCount="indefinite"
					/>
				</rect>
				<g className={PLACEMENT_FLOW_CARD_CLASSES}>
					<rect
						x="423"
						y="100"
						width="120"
						height="50"
						fill="color-mix(in srgb, var(--snapflow-ink) 95%, transparent)"
						stroke="color-mix(in srgb, var(--snapflow-paper) 15%, transparent)"
					/>
					<text
						x="483"
						y="121"
						textAnchor="middle"
						dominantBaseline="central"
						fontFamily="'Chivo Mono', monospace"
						fontSize="6.2"
						letterSpacing="1.2"
						fill="color-mix(in srgb, var(--snapflow-paper) 40%, transparent)"
						className="card-title"
					>
						INDEPENDENT MACHINE
					</text>
					<text
						x="483"
						y="133"
						textAnchor="middle"
						dominantBaseline="central"
						fontFamily="'Chivo Mono', monospace"
						fontSize="5.5"
						letterSpacing="1"
						fill="var(--snapflow-green)"
						className="card-accent"
					>
						LISTED · PRICED
					</text>
				</g>
				<g className={PLACEMENT_FLOW_CARD_CLASSES}>
					<rect
						x="203"
						y="2"
						width="140"
						height="36"
						fill="color-mix(in srgb, var(--snapflow-ink) 95%, transparent)"
						stroke="color-mix(in srgb, var(--snapflow-paper) 10%, transparent)"
					/>
					<text
						x="273"
						y="15"
						textAnchor="middle"
						dominantBaseline="central"
						fontFamily="'Chivo Mono', monospace"
						fontSize="6.5"
						letterSpacing="1.5"
						fill="color-mix(in srgb, var(--snapflow-paper) 40%, transparent)"
						className="card-title"
					>
						WHAT IT NEEDS
					</text>
					<text
						x="273"
						y="27"
						textAnchor="middle"
						dominantBaseline="central"
						fontFamily="'Chivo Mono', monospace"
						fontSize="4.5"
						letterSpacing="1"
						fill="var(--snapflow-purple)"
						className="card-accent"
					>
						CPU · RAM · DISK · GPU
					</text>
				</g>
				<line
					x1="273"
					y1="38"
					x2="273"
					y2="78"
					stroke="var(--snapflow-purple)"
					strokeWidth=".5"
					strokeOpacity=".4"
					strokeDasharray="3 5"
					pointerEvents="none"
				/>
				<rect
					x="-1.5"
					y="-1.5"
					width="3"
					height="3"
					fill="var(--snapflow-purple)"
					pointerEvents="none"
				>
					<animateMotion
						dur="1.5s"
						repeatCount="indefinite"
						keyPoints="0;1"
						keyTimes="0;1"
						calcMode="linear"
					>
						<mpath href="#snapflow-requirements-path" />
					</animateMotion>
					<animate
						attributeName="opacity"
						values=".8;.8;0"
						keyTimes="0;.6;1"
						dur="1.5s"
						repeatCount="indefinite"
					/>
				</rect>
				<g className={PLACEMENT_FLOW_CARD_CLASSES}>
					<rect
						x="203"
						y="214"
						width="140"
						height="40"
						fill="color-mix(in srgb, var(--snapflow-ink) 95%, transparent)"
						stroke="color-mix(in srgb, var(--snapflow-paper) 10%, transparent)"
					/>
					<text
						x="273"
						y="228"
						textAnchor="middle"
						dominantBaseline="central"
						fontFamily="'Chivo Mono', monospace"
						fontSize="6.5"
						letterSpacing="1.5"
						fill="color-mix(in srgb, var(--snapflow-paper) 40%, transparent)"
						className="card-title"
					>
						READY TO RUN
					</text>
					<text
						x="273"
						y="241"
						textAnchor="middle"
						dominantBaseline="central"
						fontFamily="'Chivo Mono', monospace"
						fontSize="4.5"
						letterSpacing="1"
						fill="var(--snapflow-green)"
						className="card-accent"
					>
						SANDBOX STARTING
					</text>
				</g>
				<line
					x1="273"
					y1="172"
					x2="273"
					y2="214"
					stroke="var(--snapflow-green)"
					strokeWidth=".5"
					strokeOpacity=".4"
					strokeDasharray="3 5"
					pointerEvents="none"
				/>
				<rect
					x="-1.5"
					y="-1.5"
					width="3"
					height="3"
					fill="var(--snapflow-green)"
					pointerEvents="none"
				>
					<animateMotion
						dur="1.5s"
						begin=".75s"
						repeatCount="indefinite"
						keyPoints="0;1"
						keyTimes="0;1"
						calcMode="linear"
					>
						<mpath href="#snapflow-quote-path" />
					</animateMotion>
					<animate
						attributeName="opacity"
						values=".8;.8;0"
						keyTimes="0;.6;1"
						dur="1.5s"
						begin=".75s"
						repeatCount="indefinite"
					/>
				</rect>
			</svg>
		</div>
	);
}
