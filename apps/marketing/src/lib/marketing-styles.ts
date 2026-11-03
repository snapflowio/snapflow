/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const CONTENT_WIDTH =
	'mx-auto w-[calc(100%-2.5rem)] max-w-300 min-[769px]:w-[90%] min-[1281px]:w-full';
export const SECTION_DIVIDER =
	'mx-auto h-px w-[calc(100%-2.5rem)] max-w-300 bg-snapflow-border min-[769px]:w-[90%] min-[1281px]:w-full';
export const MONO_FONT = "font-['Chivo_Mono',monospace]";
export const DISPLAY_FONT = "font-['Chalet',Inter,sans-serif] font-bold";
export const TEXT_GLOW =
	'[text-shadow:0_0_8px_var(--snapflow-ink),0_0_16px_var(--snapflow-ink),0_0_32px_var(--snapflow-ink),0_0_60px_var(--snapflow-ink),0_0_100px_var(--snapflow-ink)]';
export const CHAMFER_CLIP =
	'[clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)]';
export const HERO_BUTTON_BASE = `${MONO_FONT} relative inline-flex cursor-pointer items-center justify-center gap-2 text-[.85rem] leading-[normal] font-bold no-underline transition-all duration-200 ease-[cubic-bezier(.25,1,.5,1)] hover:animate-[snapflow-button-glitch_.3s_ease-in-out] hover:shadow-[4px_4px_0_var(--snapflow-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snapflow-ink max-md:flex-1 max-md:basis-full max-md:text-base`;
export const HERO_BUTTON = `${HERO_BUTTON_BASE} px-8 py-4 ${CHAMFER_CLIP} max-md:px-8 max-md:py-5`;
