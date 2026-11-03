// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/snapflowio/snapflow/internal/state"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

func resultEncoder() protojson.MarshalOptions {
	return protojson.MarshalOptions{EmitDefaultValues: true}
}

func (e *Executor) jobResult(job *apiclient.Job, metadata any, failure error, duration time.Duration) (state.JobResult, error) {
	status := apiclient.JobStatusCompleted
	if failure != nil {
		status = apiclient.JobStatusFailed
	}
	update := apiclient.UpdateJobStatus{
		Status:          status,
		LeaseToken:      *job.LeaseToken,
		Attempt:         job.Attempt,
		ExecutionResult: executionResult(failure, duration, e.runtimeIdentity, e.releaseIdentity),
	}
	if failure != nil {
		errorMessage := failure.Error()
		update.ErrorMessage = &errorMessage
	}
	if metadata != nil {
		encoded, err := encodeResultMetadata(metadata)
		if err != nil {
			return state.JobResult{}, fmt.Errorf("marshal job %s result metadata: %w", job.Id, err)
		}
		update.ResultMetadata = &encoded
	}
	return state.JobResult{JobID: job.Id, Update: update}, nil
}

func encodeResultMetadata(result any) (string, error) {
	if message, ok := result.(proto.Message); ok {
		encoded, err := resultEncoder().Marshal(message)
		return string(encoded), err
	}
	encoded, err := json.Marshal(result)
	return string(encoded), err
}
