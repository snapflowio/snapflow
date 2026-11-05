/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export class RefreshingValue<Value> {
	private current: { value: Value; expiresAt: number } | null = null;
	private loading: Promise<Value> | null = null;

	constructor(
		private readonly load: () => Promise<Value>,
		private readonly lifetimeMilliseconds: number
	) {}

	async get(): Promise<Value> {
		if (this.current && Date.now() < this.current.expiresAt) {
			return this.current.value;
		}
		this.loading ??= this.reload().finally(() => {
			this.loading = null;
		});
		try {
			return await this.loading;
		} catch (error) {
			if (this.current) return this.current.value;
			throw error;
		}
	}

	private async reload(): Promise<Value> {
		const value = await this.load();
		this.current = {
			value,
			expiresAt: Date.now() + this.lifetimeMilliseconds,
		};
		return value;
	}
}
