/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useEffect, useState } from 'react';

const START_DELAY_MILLISECONDS = 500;
const TYPE_DELAY_MILLISECONDS = 70;
const DELETE_DELAY_MILLISECONDS = 30;
const HOLD_DELAY_MILLISECONDS = 2000;
const NEXT_PHRASE_DELAY_MILLISECONDS = 400;

type TypingState = {
	phrase: number;
	character: number;
	deleting: boolean;
};

type TypingStep = {
	state: TypingState;
	text: string;
	delay: number;
};

function nextTypingState(
	state: TypingState,
	phrases: readonly string[]
): TypingStep {
	const value = phrases[state.phrase] ?? '';
	const character = state.character + (state.deleting ? -1 : 1);
	const text = value.slice(0, Math.max(0, character));
	if (!state.deleting && character >= value.length) {
		return {
			state: { ...state, character, deleting: true },
			text,
			delay: HOLD_DELAY_MILLISECONDS,
		};
	}
	if (state.deleting && character <= 0) {
		return {
			state: {
				phrase: (state.phrase + 1) % phrases.length,
				character,
				deleting: false,
			},
			text,
			delay: NEXT_PHRASE_DELAY_MILLISECONDS,
		};
	}
	return {
		state: { ...state, character },
		text,
		delay: state.deleting ? DELETE_DELAY_MILLISECONDS : TYPE_DELAY_MILLISECONDS,
	};
}

export function useTypingAnimation(phrases: readonly string[], active = true) {
	const [text, setText] = useState('');

	useEffect(() => {
		if (!active) {
			setText('');
			return;
		}

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			setText(phrases[0] ?? '');
			return;
		}

		let state: TypingState = { phrase: 0, character: 0, deleting: false };
		let timer = 0;
		setText('');
		const tick = () => {
			const step = nextTypingState(state, phrases);
			state = step.state;
			setText(step.text);
			timer = window.setTimeout(tick, step.delay);
		};
		timer = window.setTimeout(tick, START_DELAY_MILLISECONDS);
		return () => clearTimeout(timer);
	}, [active, phrases]);

	return text;
}
