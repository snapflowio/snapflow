// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"testing"

	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

func TestEveryMachineErrorCodeMapsToValidJobErrorCode(t *testing.T) {
	for number := range machinev1alpha1.MachineErrorCode_name {
		code := machinev1alpha1.MachineErrorCode(number)
		mapped, ok := jobErrorCodes()[code]
		if !ok {
			t.Fatalf("machine error code %s has no job error code", code)
		}
		if !mapped.Valid() {
			t.Fatalf("machine error code %s maps to invalid job error code %q", code, mapped)
		}
	}
}

func TestUnmappedMachineErrorCodeReportsUnknown(t *testing.T) {
	const unmappedCode machinev1alpha1.MachineErrorCode = -1
	if got := jobErrorCode(unmappedCode); got != apiclient.JobErrorCodeUnknown {
		t.Fatalf("expected unknown job error code, got %q", got)
	}
}
