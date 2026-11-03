/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const NATIVE_SURFACE_OCCLUSION_PREPARE_EVENT =
	'snapflow:native-surface-occlusion-prepare';
interface NativeSurfaceOcclusionPrepareDetail {
	kind: 'modal' | 'takeover';
	waitUntil: (preparation: Promise<unknown>) => void;
}
interface NativeSurfaceOcclusionPreparation {
	completion: Promise<void>;
	cancel: () => void;
}
const PENDING_NATIVE_INTERACTION_EVENTS = [
	'beforeinput',
	'compositionstart',
	'compositionupdate',
	'compositionend',
	'keydown',
	'keypress',
	'keyup',
	'paste',
	'cut',
] as const;
let pendingNativeInteractionLocks = 0;
let pendingNativeInteractionSentinel: HTMLSpanElement | null = null;
const blockPendingNativeInteraction = (event: Event) => {
	event.preventDefault();
	event.stopImmediatePropagation();
};
function acquirePendingNativeInteractionLock(): () => void {
	pendingNativeInteractionLocks++;
	if (pendingNativeInteractionLocks === 1) {
		for (const type of PENDING_NATIVE_INTERACTION_EVENTS) {
			window.addEventListener(type, blockPendingNativeInteraction, true);
		}
		const activeElement = document.activeElement;
		if (
			activeElement === null ||
			activeElement === document.body ||
			activeElement === document.documentElement
		) {
			const sentinel = document.createElement('span');
			sentinel.tabIndex = -1;
			sentinel.setAttribute('data-native-surface-interaction-sentinel', '');
			Object.assign(sentinel.style, {
				height: '1px',
				opacity: '0',
				pointerEvents: 'none',
				position: 'fixed',
				width: '1px',
			});
			document.body.appendChild(sentinel);
			sentinel.focus({ preventScroll: true });
			pendingNativeInteractionSentinel = sentinel;
		}
	}
	let released = false;
	return () => {
		if (released) return;
		released = true;
		pendingNativeInteractionLocks = Math.max(
			0,
			pendingNativeInteractionLocks - 1
		);
		if (pendingNativeInteractionLocks !== 0) return;
		for (const type of PENDING_NATIVE_INTERACTION_EVENTS) {
			window.removeEventListener(type, blockPendingNativeInteraction, true);
		}
		pendingNativeInteractionSentinel?.remove();
		pendingNativeInteractionSentinel = null;
	};
}
export function requestNativeSurfaceOcclusionPreparation(
	kind: NativeSurfaceOcclusionPrepareDetail['kind']
): NativeSurfaceOcclusionPreparation | null {
	const preparations: Promise<unknown>[] = [];
	const detail: NativeSurfaceOcclusionPrepareDetail = {
		kind,
		waitUntil: (preparation) => preparations.push(Promise.resolve(preparation)),
	};
	window.dispatchEvent(
		new CustomEvent<NativeSurfaceOcclusionPrepareDetail>(
			NATIVE_SURFACE_OCCLUSION_PREPARE_EVENT,
			{
				detail,
			}
		)
	);
	if (preparations.length === 0) return null;
	const releaseInteractionLock = acquirePendingNativeInteractionLock();
	let releaseFrame: number | null = null;
	const completion = Promise.all(preparations).then(() => undefined);
	void completion.then(
		() => {
			releaseFrame = requestAnimationFrame(() => {
				releaseFrame = null;
				releaseInteractionLock();
			});
		},
		() => {}
	);
	return {
		completion,
		cancel: () => {
			if (releaseFrame !== null) cancelAnimationFrame(releaseFrame);
			releaseFrame = null;
			releaseInteractionLock();
		},
	};
}
