/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MachineErrorCode } from '@snapflow/machine-proto';
import { JobErrorCode } from '../../machine-job/enums/job-error-code.enum';
import {
	MACHINE_FAULT_DOMAIN,
	type MachineFaultDomain,
} from '../constants/machine-reliability.constants';

const JOB_ERROR_CODE_BY_MACHINE_ERROR_CODE: Readonly<
	Record<MachineErrorCode, JobErrorCode>
> = {
	[MachineErrorCode.UNSPECIFIED]: JobErrorCode.UNSPECIFIED,
	[MachineErrorCode.NONE]: JobErrorCode.NONE,
	[MachineErrorCode.INVALID_REQUEST]: JobErrorCode.INVALID_REQUEST,
	[MachineErrorCode.STALE_ASSIGNMENT]: JobErrorCode.STALE_ASSIGNMENT,
	[MachineErrorCode.NOT_FOUND]: JobErrorCode.NOT_FOUND,
	[MachineErrorCode.IMAGE_INVALID]: JobErrorCode.IMAGE_INVALID,
	[MachineErrorCode.IMAGE_UNAVAILABLE]: JobErrorCode.IMAGE_UNAVAILABLE,
	[MachineErrorCode.SNAPSHOT_CORRUPT]: JobErrorCode.SNAPSHOT_CORRUPT,
	[MachineErrorCode.PLATFORM_BUNDLE_FETCH_FAILED]:
		JobErrorCode.PLATFORM_BUNDLE_FETCH_FAILED,
	[MachineErrorCode.PLATFORM_BUNDLE_MOUNT_FAILED]:
		JobErrorCode.PLATFORM_BUNDLE_MOUNT_FAILED,
	[MachineErrorCode.PLATFORM_COMPONENT_NOT_FOUND]:
		JobErrorCode.PLATFORM_COMPONENT_NOT_FOUND,
	[MachineErrorCode.PLATFORM_COMPONENT_NOT_EXECUTABLE]:
		JobErrorCode.PLATFORM_COMPONENT_NOT_EXECUTABLE,
	[MachineErrorCode.GUEST_AUTHENTICATION_FAILED]:
		JobErrorCode.GUEST_AUTHENTICATION_FAILED,
	[MachineErrorCode.RUNTIME_UNAVAILABLE]: JobErrorCode.RUNTIME_UNAVAILABLE,
	[MachineErrorCode.GUEST_NOT_READY]: JobErrorCode.GUEST_NOT_READY,
	[MachineErrorCode.HOST_IO_FAILED]: JobErrorCode.HOST_IO_FAILED,
	[MachineErrorCode.RUNTIME_MISSING]: JobErrorCode.RUNTIME_MISSING,
	[MachineErrorCode.INSUFFICIENT_CAPACITY]: JobErrorCode.INSUFFICIENT_CAPACITY,
	[MachineErrorCode.CANCELLED]: JobErrorCode.CANCELLED,
	[MachineErrorCode.DEADLINE_EXCEEDED]: JobErrorCode.DEADLINE_EXCEEDED,
	[MachineErrorCode.UNKNOWN]: JobErrorCode.UNKNOWN,
};

export function jobErrorCode(code: MachineErrorCode): JobErrorCode {
	return JOB_ERROR_CODE_BY_MACHINE_ERROR_CODE[code] ?? JobErrorCode.UNKNOWN;
}

const FAULT_DOMAIN_BY_CODE: Readonly<Record<JobErrorCode, MachineFaultDomain>> =
	{
		[JobErrorCode.UNSPECIFIED]: MACHINE_FAULT_DOMAIN.UNKNOWN,
		[JobErrorCode.NONE]: MACHINE_FAULT_DOMAIN.UNKNOWN,
		[JobErrorCode.INVALID_REQUEST]: MACHINE_FAULT_DOMAIN.CONTROL_PLANE,
		[JobErrorCode.STALE_ASSIGNMENT]: MACHINE_FAULT_DOMAIN.CONTROL_PLANE,
		[JobErrorCode.NOT_FOUND]: MACHINE_FAULT_DOMAIN.WORKLOAD,
		[JobErrorCode.IMAGE_INVALID]: MACHINE_FAULT_DOMAIN.CUSTOMER_CONFIGURATION,
		[JobErrorCode.IMAGE_UNAVAILABLE]: MACHINE_FAULT_DOMAIN.EXTERNAL,
		[JobErrorCode.SNAPSHOT_CORRUPT]: MACHINE_FAULT_DOMAIN.MACHINE,
		[JobErrorCode.PLATFORM_BUNDLE_FETCH_FAILED]:
			MACHINE_FAULT_DOMAIN.CONTROL_PLANE,
		[JobErrorCode.PLATFORM_BUNDLE_MOUNT_FAILED]: MACHINE_FAULT_DOMAIN.MACHINE,
		[JobErrorCode.PLATFORM_COMPONENT_NOT_FOUND]:
			MACHINE_FAULT_DOMAIN.CONTROL_PLANE,
		[JobErrorCode.PLATFORM_COMPONENT_NOT_EXECUTABLE]:
			MACHINE_FAULT_DOMAIN.CONTROL_PLANE,
		[JobErrorCode.GUEST_AUTHENTICATION_FAILED]: MACHINE_FAULT_DOMAIN.MACHINE,
		[JobErrorCode.RUNTIME_UNAVAILABLE]: MACHINE_FAULT_DOMAIN.MACHINE,
		[JobErrorCode.GUEST_NOT_READY]: MACHINE_FAULT_DOMAIN.WORKLOAD,
		[JobErrorCode.HOST_IO_FAILED]: MACHINE_FAULT_DOMAIN.MACHINE,
		[JobErrorCode.RUNTIME_MISSING]: MACHINE_FAULT_DOMAIN.MACHINE,
		[JobErrorCode.INSUFFICIENT_CAPACITY]: MACHINE_FAULT_DOMAIN.MACHINE,
		[JobErrorCode.CANCELLED]: MACHINE_FAULT_DOMAIN.CONTROL_PLANE,
		[JobErrorCode.DEADLINE_EXCEEDED]: MACHINE_FAULT_DOMAIN.CONTROL_PLANE,
		[JobErrorCode.UNKNOWN]: MACHINE_FAULT_DOMAIN.UNKNOWN,
	};

export function claimedFaultDomain(code: JobErrorCode): MachineFaultDomain {
	return FAULT_DOMAIN_BY_CODE[code];
}
