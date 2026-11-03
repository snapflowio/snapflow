/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AnchorHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { useInView } from '@/hooks/use-in-view';
import { DISPLAY_FONT, MONO_FONT } from '@/lib/marketing-styles';

const badgeIcons = {
	problem:
		'M 11 11 L 13 11 L 13 13 L 11 13 Z M 15 7 L 17 7 L 17 9 L 15 9 Z M 7 7 L 9 7 L 9 9 L 7 9 Z M 7 15 L 9 15 L 9 17 L 7 17 Z M 15 15 L 17 15 L 17 17 L 15 17 Z M 5 17 L 7 17 L 7 19 L 5 19 Z M 5 5 L 7 5 L 7 7 L 5 7 Z M 9 13 L 11 13 L 11 15 L 9 15 Z M 13 13 L 15 13 L 15 15 L 13 15 Z M 13 9 L 15 9 L 15 11 L 13 11 Z M 9 9 L 11 9 L 11 11 L 9 11 Z M 17 5 L 19 5 L 19 7 L 17 7 Z M 17 17 L 19 17 L 19 19 L 17 19 Z',
	intro:
		'M 14 11 L 16 11 L 16 13 L 14 13 Z M 18 7 L 20 7 L 20 9 L 18 9 Z M 4 13 L 6 13 L 6 15 L 4 15 Z M 10 15 L 12 15 L 12 17 L 10 17 Z M 8 17 L 10 17 L 10 19 L 8 19 Z M 12 13 L 14 13 L 14 15 L 12 15 Z M 16 9 L 18 9 L 18 11 L 16 11 Z M 6 15 L 8 15 L 8 17 L 6 17 Z',
	offline:
		'M 5 4 L 19 4 L 19 6 L 5 6 Z M 19 15 L 19 6 L 21 6 L 21 17 L 3 17 L 3 6 L 5 6 L 5 15 Z M 3 18 L 21 18 L 21 20 L 3 20 Z',
	unlimited:
		'M 22 11 L 22 13 L 20 13 L 20 15 L 18 15 L 18 9 L 20 9 L 20 11 Z M 6 10 L 8 10 L 8 14 L 6 14 Z M 9 10 L 11 10 L 11 14 L 9 14 Z M 12 10 L 14 10 L 14 14 L 12 14 Z M 15 10 L 17 10 L 17 14 L 15 14 Z M 18 7 L 18 9 L 5 9 L 5 15 L 18 15 L 18 17 L 3 17 L 3 7 Z',
	privacy:
		'M 10 4 L 14 4 L 14 6 L 10 6 Z M 11 13 L 13 13 L 13 17 L 11 17 Z M 6 10 L 8 10 L 8 6 L 10 6 L 10 10 L 14 10 L 14 6 L 16 6 L 16 10 L 18 10 L 18 12 L 6 12 Z M 6 18 L 18 18 L 18 20 L 6 20 Z M 18 12 L 20 12 L 20 18 L 18 18 Z M 4 12 L 6 12 L 6 18 L 4 18 Z',
	latency:
		'M 8 4 L 11 4 L 11 3 L 9 3 L 9 1 L 15 1 L 15 3 L 13 3 L 13 4 L 16 4 L 16 6 L 8 6 Z M 8 18 L 16 18 L 16 20 L 8 20 Z M 16 6 L 18 6 L 18 8 L 16 8 Z M 18 8 L 20 8 L 20 16 L 18 16 Z M 4 8 L 6 8 L 6 16 L 4 16 Z M 6 6 L 8 6 L 8 8 L 6 8 Z M 11 8 L 13 8 L 13 11 L 16 11 L 16 13 L 11 13 Z M 6 16 L 8 16 L 8 18 L 6 18 Z M 16 16 L 18 16 L 18 18 L 16 18 Z',
	approach:
		'M 10 4 L 16 4 L 16 6 L 10 6 Z M 10 16 L 16 16 L 16 18 L 10 18 Z M 16 6 L 18 6 L 18 8 L 16 8 Z M 18 8 L 20 8 L 20 14 L 18 14 Z M 6 8 L 8 8 L 8 14 L 6 14 Z M 8 6 L 10 6 L 10 8 L 8 8 Z M 8 14 L 10 14 L 10 16 L 8 16 Z M 6 16 L 8 16 L 8 18 L 6 18 Z M 4 18 L 6 18 L 6 20 L 4 20 Z M 16 14 L 18 14 L 18 16 L 16 16 Z',
	capabilities:
		'M 6 4 L 8 4 L 8 2 L 10 2 L 10 4 L 14 4 L 14 2 L 16 2 L 16 4 L 18 4 L 18 6 L 6 6 Z M 6 18 L 18 18 L 18 20 L 16 20 L 16 22 L 14 22 L 14 20 L 10 20 L 10 22 L 8 22 L 8 20 L 6 20 Z M 18 6 L 20 6 L 20 8 L 22 8 L 22 10 L 20 10 L 20 14 L 22 14 L 22 16 L 20 16 L 20 18 L 18 18 Z M 4 6 L 6 6 L 6 18 L 4 18 L 4 16 L 2 16 L 2 14 L 4 14 L 4 10 L 2 10 L 2 8 L 4 8 Z M 15 15 L 17 15 L 17 17 L 15 17 Z M 15 7 L 17 7 L 17 9 L 15 9 Z M 7 7 L 9 7 L 9 9 L 7 9 Z M 7 15 L 9 15 L 9 17 L 7 17 Z',
	hosts:
		'M 6 2 L 18 2 L 18 4 L 6 4 Z M 6 20 L 18 20 L 18 22 L 6 22 Z M 4 4 L 6 4 L 6 20 L 4 20 Z M 18 4 L 20 4 L 20 20 L 18 20 Z M 8 7 L 16 7 L 16 9 L 8 9 Z M 8 11 L 16 11 L 16 13 L 8 13 Z M 8 16 L 10 16 L 10 18 L 8 18 Z M 12 16 L 14 16 L 14 18 L 12 18 Z',
	terminal:
		'M 2 13 L 8 13 L 8 15 L 6 15 L 6 20 L 4 20 L 4 15 L 2 15 Z M 16 15 L 18 15 L 18 4 L 20 4 L 20 15 L 22 15 L 22 17 L 20 17 L 20 20 L 18 20 L 18 17 L 16 17 Z M 9 7 L 11 7 L 11 4 L 13 4 L 13 7 L 15 7 L 15 9 L 9 9 Z M 11 11 L 13 11 L 13 20 L 11 20 Z M 4 4 L 6 4 L 6 11 L 4 11 Z',
	early:
		'M 5 5 L 19 5 L 19 7 L 5 7 Z M 5 17 L 19 17 L 19 19 L 5 19 Z M 19 7 L 21 7 L 21 17 L 19 17 Z M 3 7 L 5 7 L 5 17 L 3 17 Z M 11 13 L 13 13 L 13 15 L 11 15 Z M 13 11 L 15 11 L 15 13 L 13 13 Z M 15 13 L 17 13 L 17 15 L 15 15 Z M 9 11 L 11 11 L 11 13 L 9 13 Z M 7 13 L 9 13 L 9 15 L 7 15 Z M 15 9 L 17 9 L 17 11 L 15 11 Z M 7 9 L 9 9 L 9 11 L 7 11 Z',
	faq: 'M 10 2 L 14 2 L 14 4 L 10 4 Z M 8 4 L 10 4 L 10 6 L 8 6 Z M 14 4 L 16 4 L 16 6 L 14 6 Z M 6 6 L 8 6 L 8 8 L 6 8 Z M 16 6 L 18 6 L 18 8 L 16 8 Z M 6 8 L 8 8 L 8 14 L 6 14 Z M 16 8 L 18 8 L 18 14 L 16 14 Z M 14 14 L 16 14 L 16 16 L 14 16 Z M 14 16 L 14 18 L 12 18 L 12 16 Z M 12 20 L 14 20 L 14 22 L 12 22 Z',
} as const;

export type BadgeIcon = keyof typeof badgeIcons;

export function Badge({
	children,
	icon,
	className = '',
}: PropsWithChildren<{ icon: BadgeIcon; className?: string }>) {
	return (
		<span
			className={`${MONO_FONT} mx-auto flex w-fit gap-[.6rem] border border-snapflow-purple/20 bg-snapflow-ink/88 px-4 py-2 text-[.75rem] text-snapflow-purple uppercase tracking-[.12em] leading-[normal] backdrop-blur-md ${className}`}
		>
			<svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
				<path d={badgeIcons[icon]} fill="currentColor" />
			</svg>
			{children}
		</span>
	);
}

export function MarketingButton({
	className = '',
	children,
	...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
	return (
		<a
			className={`${MONO_FONT} inline-flex cursor-pointer items-center justify-center gap-2 bg-snapflow-purple px-8 py-4 text-[.85rem] leading-[normal] font-bold text-snapflow-ink transition-all duration-200 ease-[cubic-bezier(.25,1,.5,1)] hover:animate-[snapflow-button-glitch_.3s_ease-in-out] hover:shadow-[4px_4px_0_var(--snapflow-blue)] focus-visible:outline-2 focus-visible:outline-snapflow-purple focus-visible:outline-offset-2 [clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)] ${className}`}
			{...props}
		>
			{children}
		</a>
	);
}

export function AnimatedSection({
	children,
	className = '',
	id,
}: {
	children: ReactNode;
	className?: string;
	id?: string;
}) {
	const { ref, visible } = useInView<HTMLElement>();
	return (
		<section
			ref={ref}
			id={id}
			className={`${className} ${visible ? 'is-visible' : ''}`}
		>
			{children}
		</section>
	);
}

export function SectionHeading({
	eyebrow,
	title,
	body,
	align = 'center',
	icon,
	size = 'standard',
}: {
	eyebrow: string;
	title: string;
	body?: string;
	align?: 'center' | 'left';
	icon: BadgeIcon;
	size?: 'standard' | 'large';
}) {
	return (
		<div
			className={
				align === 'center'
					? `mx-auto ${size === 'large' ? 'max-w-205' : 'max-w-170'} text-center`
					: 'max-w-155'
			}
		>
			<Badge icon={icon}>{eyebrow}</Badge>
			<h2
				className={`${DISPLAY_FONT} ${size === 'large' ? 'mt-8' : 'mt-6'} text-balance leading-[.92] tracking-[-.03em] ${size === 'large' ? 'text-[clamp(3rem,5vw,4.5rem)]' : 'text-[clamp(2.5rem,4vw,3.5rem)]'}`}
			>
				{title.split('\n').map((line, index) => (
					<span key={line}>
						{index > 0 ? <br /> : null}
						{line}
					</span>
				))}
			</h2>
			{body ? (
				<p className="mt-6 text-balance text-base leading-[1.6] text-snapflow-paper-dim">
					{body}
				</p>
			) : null}
		</div>
	);
}
