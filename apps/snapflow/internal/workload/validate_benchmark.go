// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package workload

import (
	"errors"
	"fmt"

	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const (
	minimumSuiteVersion = uint32(1)
	minimumShapeSize    = uint32(1)
)

func validateBenchmarkMachine(payload *machinev1alpha1.BenchmarkMachinePayload) error {
	return errors.Join(
		uuidField("benchmarkId", payload.GetBenchmarkId()),
		sha256HexField("nonce", payload.GetNonce()),
		minimumField("suiteVersion", payload.GetSuiteVersion(), minimumSuiteVersion),
		validateBenchmarkShape(payload.GetShape()),
		urlField("speedtestUrl", payload.GetSpeedtestUrl()),
		requiredField("speedtestToken", payload.GetSpeedtestToken()),
		timestampField("issuedAt", payload.GetIssuedAt()),
		timestampField("expiresAt", payload.GetExpiresAt()),
	)
}

func validateBenchmarkShape(shape *machinev1alpha1.BenchmarkShape) error {
	if shape == nil {
		return errors.New("shape is required")
	}
	return errors.Join(
		minimumField("shape.cpu", shape.GetCpu(), minimumShapeSize),
		minimumField("shape.memoryGib", shape.GetMemoryGib(), minimumShapeSize),
		minimumField("shape.diskGib", shape.GetDiskGib(), minimumShapeSize),
	)
}

func timestampField(field string, value *timestamppb.Timestamp) error {
	if value == nil {
		return fmt.Errorf("%s is required", field)
	}
	if err := value.CheckValid(); err != nil {
		return fmt.Errorf("%s is invalid: %w", field, err)
	}
	return nil
}
