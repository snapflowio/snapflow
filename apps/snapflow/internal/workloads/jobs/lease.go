// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package jobs

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/snapflowio/common-go/pkg/apierror"
	apiclient "github.com/snapflowio/snapflow/libs/api-client-go"
)

const (
	jobLeaseRenewalInterval = time.Minute
	jobLeaseRetryInterval   = 10 * time.Second
	jobLeaseRenewalTimeout  = 30 * time.Second
)

var errLeaseLost = errors.New("job lease was lost")

func (e *Executor) executeWithLeaseRenewal(ctx context.Context, running *execution, job *apiclient.Job) (any, error) {
	renewalDone := make(chan struct{})
	go func() {
		defer close(renewalDone)
		e.maintainLease(ctx, job, running.cancel)
	}()

	result, executionErr := e.executeJob(ctx, job)
	running.cancel(nil)
	<-renewalDone
	if cause := context.Cause(ctx); errors.Is(cause, errLeaseLost) {
		return result, errors.Join(executionErr, cause)
	}
	return result, executionErr
}

func (e *Executor) maintainLease(ctx context.Context, job *apiclient.Job, cancel context.CancelCauseFunc) {
	timer := time.NewTimer(e.lease.renewal)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}
		err := e.renewJobLease(ctx, job)
		switch {
		case err == nil:
			timer.Reset(e.lease.renewal)
		case ctx.Err() != nil:
			return
		case leaseLost(err):
			e.log.WarnContext(ctx, "Job lease was rejected; canceling the job", "job_id", job.Id, "error", err)
			cancel(fmt.Errorf("%w: %w", errLeaseLost, err))
			return
		default:
			e.log.WarnContext(ctx, "Job lease renewal failed; retrying", "job_id", job.Id, "error", err)
			timer.Reset(e.lease.retry)
		}
	}
}

func leaseLost(err error) bool {
	return apierror.HasStatus(err, http.StatusConflict) || apierror.HasStatus(err, http.StatusNotFound)
}

func (e *Executor) renewJobLease(ctx context.Context, job *apiclient.Job) error {
	requestContext, cancel := context.WithTimeout(ctx, jobLeaseRenewalTimeout)
	defer cancel()
	result, err := e.client.RenewJobLeaseWithResponse(requestContext, job.Id, apiclient.RenewJobLease{
		LeaseToken: *job.LeaseToken,
		Attempt:    job.Attempt,
	})
	return apierror.CheckResponse(fmt.Sprintf("renew lease for job %s", job.Id), result, err)
}

type leaseTiming struct {
	renewal time.Duration
	retry   time.Duration
}

func defaultLeaseTiming() leaseTiming {
	return leaseTiming{renewal: jobLeaseRenewalInterval, retry: jobLeaseRetryInterval}
}
