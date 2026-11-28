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

const PadlockScene = lazy(() =>
	import('./padlock/padlock-scene').then((module) => ({
		default: module.PadlockScene,
	}))
);

function subscribeNothing() {
	return () => undefined;
}

export function CloudLock() {
	const { ref, visible } = useInView<HTMLDivElement>();
	const isClient = useSyncExternalStore(
		subscribeNothing,
		() => true,
		() => false
	);
	const reducedMotion = usePrefersReducedMotion();
	const [ready, setReady] = useState(false);
	const markReady = useCallback(() => setReady(true), []);
	return (
		<div ref={ref} className="relative size-full" aria-hidden="true">
			<div
				className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${ready ? 'opacity-100' : 'opacity-0'}`}
			>
				{isClient && (
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
