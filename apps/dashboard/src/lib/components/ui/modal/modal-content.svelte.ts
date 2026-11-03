/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createContext } from 'svelte';
import { requestNativeSurfaceOcclusionPreparation } from './modal-native-surface.ts';

interface ModalContentOptions {
	dismissDisabled: () => boolean;
	onNativeSurfaceReady: () => void;
}

export class ModalContentState {
	nativeSurfaceReady = $state(true);
	#barrierClaimed = false;
	readonly #options: ModalContentOptions;

	constructor(options: ModalContentOptions) {
		this.#options = options;
	}

	get dismissDisabled(): boolean {
		return this.#options.dismissDisabled();
	}

	get awaitingNativeSurface(): boolean {
		return this.#barrierClaimed && !this.nativeSurfaceReady;
	}

	prepareNativeSurface = (): (() => void) => {
		let active = true;
		this.nativeSurfaceReady = false;
		const preparation = requestNativeSurfaceOcclusionPreparation('modal');
		this.#barrierClaimed = preparation !== null;
		if (!preparation) {
			this.nativeSurfaceReady = true;
		} else {
			void preparation.completion.then(
				() => {
					if (!active) return;
					this.nativeSurfaceReady = true;
					this.#options.onNativeSurfaceReady();
				},
				() => {}
			);
		}
		return () => {
			active = false;
			this.#barrierClaimed = false;
			preparation?.cancel();
		};
	};
}

const [getModalContent, setModalContent, hasModalContent] =
	createContext<ModalContentState>();

export { hasModalContent, setModalContent };

export function findModalContent(): ModalContentState | null {
	return hasModalContent() ? getModalContent() : null;
}
