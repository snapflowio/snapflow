/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useState } from 'react';
import { AnimatedSection, Badge } from '@/components/ui/marketing-primitives';
import { FAQS } from '@/data/faqs';
import { CONTENT_WIDTH, DISPLAY_FONT, MONO_FONT } from '@/lib/marketing-styles';

export function FaqSection() {
	const [openItems, setOpenItems] = useState<Set<number>>(() => new Set());
	const toggle = (index: number) => {
		setOpenItems((current) => {
			const next = new Set(current);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	};

	return (
		<AnimatedSection
			id="faq"
			className="py-16 min-[769px]:pt-32 min-[769px]:pb-0"
		>
			<div className={`${CONTENT_WIDTH} px-5 min-[769px]:px-0`}>
				<div className="text-center">
					<Badge icon="faq">FAQ</Badge>
					<h2
						className={`${DISPLAY_FONT} mt-8 text-[clamp(2.5rem,4vw,3.5rem)] leading-[.92] tracking-[-.03em]`}
					>
						Frequently asked questions.
					</h2>
				</div>
				<div className="mt-8 border-snapflow-border border-b min-[769px]:mt-16">
					{FAQS.map(([question, answer], index) => (
						<div
							key={question}
							className="group border-snapflow-border border-t px-6"
						>
							<button
								type="button"
								className="flex w-full cursor-pointer items-center gap-4 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-purple md:gap-5 md:py-6"
								aria-expanded={openItems.has(index)}
								onClick={() => toggle(index)}
							>
								<span
									className={`${MONO_FONT} text-[.7rem] font-bold text-snapflow-purple`}
								>
									{String(index + 1).padStart(2, '0')}
								</span>
								<span
									className={`${DISPLAY_FONT} flex-1 text-[1.05rem] leading-[1.2] tracking-[-.02em] group-hover:text-snapflow-paper md:text-[1.2rem]`}
								>
									{question}
								</span>
								<span
									className={`shrink-0 text-snapflow-paper/35 transition-[transform,color] duration-300 ease-[ease] group-hover:text-snapflow-paper/50 ${openItems.has(index) ? 'transform-[rotate(180deg)] text-snapflow-purple' : ''}`}
									aria-hidden="true"
								>
									<svg
										className="size-5"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<polyline points="6 9 12 15 18 9" />
									</svg>
								</span>
							</button>
							<div
								className={`grid transition-[grid-template-rows] duration-300 ease-[ease] ${openItems.has(index) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
							>
								<div className="min-h-0 overflow-hidden">
									<p className="max-w-150 pb-6 pl-10 text-[.85rem] leading-[1.7] text-snapflow-paper-dim md:pl-9 md:text-[.9rem]">
										{answer}
									</p>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</AnimatedSection>
	);
}
