/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export class CoalescingRunner {
	private running: Promise<void> | null = null;
	private rerunRequested = false;

	constructor(private readonly task: () => Promise<void>) {}

	run(): Promise<void> {
		if (this.running !== null) {
			this.rerunRequested = true;
			return this.running;
		}
		this.running = this.drain().finally(() => {
			this.running = null;
		});
		return this.running;
	}

	private async drain(): Promise<void> {
		do {
			this.rerunRequested = false;
			await this.task();
		} while (this.rerunRequested);
	}
}
