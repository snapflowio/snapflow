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

	"github.com/snapflowio/snapflow/internal/jobs/qualification"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

func (e *Executor) qualifyMachine(ctx context.Context, job *apiclient.Job) (any, error) {
	evidence, err := qualification.Run(ctx, qualification.Config{
		Runtime: e.runtime, LocalRuntimes: e.localRuntimes, Converger: e.converger, Identity: e.identity,
		SessionID: e.session.ID, SessionGeneration: int(e.session.Generation),
		ReleaseDigest: e.releaseIdentity, WorkDirectory: e.qualificationDirectory,
	}, jobPayload(job), qualification.WithLogger(e.log))
	if err != nil {
		return nil, fmt.Errorf("execute machine qualification: %w", err)
	}
	return evidence, nil
}
