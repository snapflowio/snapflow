/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

class AdminMfaStepUp {
	#pending: PromiseWithResolvers<boolean> | null = $state.raw(null);

	get open(): boolean {
		return this.#pending !== null;
	}

	request = (): Promise<boolean> => {
		this.#pending ??= Promise.withResolvers<boolean>();
		return this.#pending.promise;
	};

	settle = (verified: boolean): void => {
		const pending = this.#pending;
		this.#pending = null;
		pending?.resolve(verified);
	};
}

export const adminMfaStepUp = new AdminMfaStepUp();
