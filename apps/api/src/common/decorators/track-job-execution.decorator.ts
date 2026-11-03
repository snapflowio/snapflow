/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

interface ActiveJobOwner {
	activeJobs: Set<PropertyKey>;
}

export function TrackJobExecution() {
	return (
		target: object,
		propertyKey: PropertyKey,
		descriptor: PropertyDescriptor
	) => {
		const original = descriptor.value;
		if (typeof original !== 'function') {
			throw new TypeError('@TrackJobExecution can only decorate methods');
		}

		descriptor.value = async function (
			this: ActiveJobOwner,
			...args: unknown[]
		) {
			if (!this.activeJobs) {
				throw new Error(
					`@TrackJobExecution requires 'activeJobs' property on ${target.constructor.name}`
				);
			}

			this.activeJobs.add(propertyKey);
			try {
				return await original.apply(this, args);
			} finally {
				this.activeJobs.delete(propertyKey);
			}
		};
	};
}
