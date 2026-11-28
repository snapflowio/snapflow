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
import { coinFrameloop } from '@/components/landing/visuals/usdc-coin/usdc-coin';
import { useInView } from '@/hooks/use-in-view';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { loadGateState } from '@/lib/load-gate';
import { subscribeNothing, supportsWebgl } from './webgl/webgl-support';

const PadlockScene = lazy(() =>
	import('./padlock/padlock-scene').then((module) => ({
		default: module.PadlockScene,
	}))
);

export function CloudLock() {
	const { ref, visible } = useInView<HTMLDivElement>();
	const webgl = useSyncExternalStore<boolean | null>(
		subscribeNothing,
		supportsWebgl,
		() => null
	);
	const reducedMotion = usePrefersReducedMotion();
	const [ready, setReady] = useState(false);
	const markReady = useCallback(() => setReady(true), []);
	return (
		<div
			ref={ref}
			className="relative size-full"
			aria-hidden="true"
			data-load-gate={loadGateState(ready || webgl === false)}
		>
			<div className={`absolute inset-0 ${ready ? '' : 'invisible'}`}>
				{webgl && (
					<Suspense fallback={null}>
						<PadlockScene
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
