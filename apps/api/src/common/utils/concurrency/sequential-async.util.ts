/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export async function mapSequentially<TItem, TResult>(
	items: readonly TItem[],
	operation: (item: TItem, index: number) => Promise<TResult>
): Promise<Awaited<TResult>[]> {
	const results: Awaited<TResult>[] = [];
	for (const [index, item] of items.entries()) {
		results.push(await operation(item, index));
	}
	return results;
}

export async function settleSequentially<TItem, TResult>(
	items: readonly TItem[],
	operation: (item: TItem, index: number) => Promise<TResult>
): Promise<PromiseSettledResult<Awaited<TResult>>[]> {
	const results: PromiseSettledResult<Awaited<TResult>>[] = [];
	for (const [index, item] of items.entries()) {
		try {
			results.push({
				status: 'fulfilled',
				value: await operation(item, index),
			});
		} catch (reason) {
			results.push({ status: 'rejected', reason });
		}
	}
	return results;
}

export async function mapWithConcurrency<TItem, TResult>(
	items: readonly TItem[],
	concurrency: number,
	operation: (item: TItem, index: number) => Promise<TResult>
): Promise<Awaited<TResult>[]> {
	if (!Number.isInteger(concurrency) || concurrency < 1) {
		throw new RangeError('Concurrency must be a positive integer');
	}

	const results: Awaited<TResult>[] = new Array(items.length);
	let nextIndex = 0;
	const workerCount = Math.min(concurrency, items.length);
	const workers = Array.from({ length: workerCount }, async () => {
		while (nextIndex < items.length) {
			const index = nextIndex;
			nextIndex += 1;
			results[index] = await operation(items[index], index);
		}
	});

	await Promise.all(workers);
	return results;
}
