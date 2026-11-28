/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { validateMnemonic } from '@scure/bip39';
import type { Address } from 'viem';
import {
	english,
	generateMnemonic,
	type HDAccount,
	mnemonicToAccount,
} from 'viem/accounts';
import { SnapflowValidationError } from '../errors/snapflow-error.js';

const ENTROPY_BITS = 128;
const ENTROPY_BITS_PER_CHECKSUM_BIT = 32;
const CHECKSUM_BITS = ENTROPY_BITS / ENTROPY_BITS_PER_CHECKSUM_BIT;
const BITS_PER_WORD = 11;
export const RECOVERY_PHRASE_WORDS =
	(ENTROPY_BITS + CHECKSUM_BITS) / BITS_PER_WORD;
const WORD_SEPARATOR = /\s+/;

export interface RecoveryPhrase {
	phrase: string;
	address: Address;
}

export function generateRecoveryPhrase(): RecoveryPhrase {
	const phrase = generateMnemonic(english, ENTROPY_BITS);
	return { phrase, address: mnemonicToAccount(phrase).address };
}

function validatedPhrase(phrase: string): string {
	const words = phrase.trim().toLowerCase().split(WORD_SEPARATOR);
	if (words.length !== RECOVERY_PHRASE_WORDS) {
		throw new SnapflowValidationError(
			`A recovery phrase has ${RECOVERY_PHRASE_WORDS} words, not ${words.length}`
		);
	}
	const unknown = words.find((word) => !english.includes(word));
	if (unknown !== undefined) {
		throw new SnapflowValidationError(
			`"${unknown}" is not a word of the recovery phrase list`
		);
	}
	const canonical = words.join(' ');
	if (!validateMnemonic(canonical, english)) {
		throw new SnapflowValidationError(
			'The recovery phrase checksum does not match; check the words and their order'
		);
	}
	return canonical;
}

export function recoveryPhraseAccount(phrase: string): HDAccount {
	return mnemonicToAccount(validatedPhrase(phrase));
}
