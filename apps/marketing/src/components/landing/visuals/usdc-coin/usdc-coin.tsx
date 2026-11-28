/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	lazy,
	Suspense,
	useCallback,
	useState,
	useSyncExternalStore,
} from 'react';
import { useInView } from '@/hooks/use-in-view';
import { loadGateState } from '@/lib/load-gate';
import { subscribeNothing, supportsWebgl } from '../webgl/webgl-support';
import type { CoinFrameloop } from './usdc-coin-scene';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const UsdcCoinScene = lazy(() =>
	import('./usdc-coin-scene').then((module) => ({
		default: module.UsdcCoinScene,
	}))
);

function subscribeReducedMotion(onChange: () => void) {
	const media = window.matchMedia(REDUCED_MOTION_QUERY);
	media.addEventListener('change', onChange);
	return () => media.removeEventListener('change', onChange);
}

export function coinFrameloop(
	ready: boolean,
	visible: boolean,
	reducedMotion: boolean
): CoinFrameloop {
	if (!ready) return 'always';
	if (reducedMotion) return 'demand';
	return visible ? 'always' : 'never';
}

export function UsdcCoin() {
	const { ref, visible } = useInView<HTMLDivElement>();
	const webgl = useSyncExternalStore<boolean | null>(
		subscribeNothing,
		supportsWebgl,
		() => null
	);
	const reducedMotion = useSyncExternalStore(
		subscribeReducedMotion,
		() => window.matchMedia(REDUCED_MOTION_QUERY).matches,
		() => false
	);
	const [ready, setReady] = useState(false);
	const markReady = useCallback(() => setReady(true), []);
	return (
		<div
			ref={ref}
			className="pointer-events-none absolute inset-0 overflow-hidden"
			aria-hidden="true"
			data-load-gate={loadGateState(ready || webgl === false)}
		>
			<div className={`absolute inset-0 ${ready ? '' : 'invisible'}`}>
				{webgl && (
					<Suspense fallback={null}>
						<UsdcCoinScene
							frameloop={coinFrameloop(ready, visible, reducedMotion)}
							animate={!reducedMotion}
							onReady={markReady}
						/>
					</Suspense>
				)}
			</div>
		</div>
	);
}
