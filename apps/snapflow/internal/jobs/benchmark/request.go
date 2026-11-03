// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package benchmark

import (
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/snapflowio/snapflow/internal/jobs/benchmark/suite"
	"github.com/snapflowio/snapflow/internal/workload"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
)

const maximumClockSkew = 30 * time.Second

type Job struct {
	ResourceID string
	Payload    string
}

func decodeChallenge(job Job, machineID string, now time.Time) (*machinev1alpha1.BenchmarkMachinePayload, error) {
	challenge := &machinev1alpha1.BenchmarkMachinePayload{}
	if err := workload.Decode(job.Payload, challenge); err != nil {
		return nil, err
	}
	if job.ResourceID != machineID {
		return nil, errors.New("the machine benchmark job is addressed to another machine")
	}
	if challenge.GetSuiteVersion() != suite.SuiteVersion {
		return nil, fmt.Errorf("machine benchmark suite version %d is not supported", challenge.GetSuiteVersion())
	}
	issuedAt, expiresAt := challenge.GetIssuedAt().AsTime(), challenge.GetExpiresAt().AsTime()
	if !now.Before(expiresAt) || issuedAt.After(now.Add(maximumClockSkew)) || !issuedAt.Before(expiresAt) {
		return nil, errors.New("the machine benchmark challenge is expired or has invalid time bounds")
	}
	if shape := challenge.GetShape(); max(shape.GetCpu(), shape.GetMemoryGib(), shape.GetDiskGib(), shape.GetGpu()) > math.MaxInt32 {
		return nil, errors.New("the machine benchmark shape exceeds the sandbox resource range")
	}
	return challenge, nil
}
