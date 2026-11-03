// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"context"
	"fmt"

	"github.com/snapflowio/snapflow/internal/jobs/benchmark"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func (e *Executor) benchmarkMachine(ctx context.Context, job *apiclient.Job) (any, error) {
	result, err := benchmark.Run(ctx, benchmark.Config{
		Runtime: e.runtime, LocalRuntimes: e.localRuntimes, Converger: e.converger,
		Identity: e.identity, HostInventory: e.hostInventory, BenchmarkImage: e.runtime.BenchmarkImage(),
	}, benchmark.Job{ResourceID: job.ResourceId, Payload: jobPayload(job)})
	if err != nil {
		return nil, fmt.Errorf("execute the machine benchmark: %w", err)
	}
	return result, nil
}
