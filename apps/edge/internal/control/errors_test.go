// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package control

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/snapflowio/common-go/pkg/apierror"
)

const testOperation = "test operation"

type stubResult struct {
	statusCode int
}

func (result stubResult) StatusCode() int {
	return result.statusCode
}

func (stubResult) GetBody() []byte {
	return []byte("rejected")
}

func apiFailure(statusCode int) error {
	return apierror.CheckResponse(testOperation, stubResult{statusCode: statusCode}, nil)
}

func TestControlOperationRetryClassification(t *testing.T) {
	t.Parallel()
	for name, test := range map[string]struct {
		err       error
		retryable bool
	}{
		"transport failure":     {err: errors.New("connection refused"), retryable: true},
		"server error":          {err: apiFailure(http.StatusBadGateway), retryable: true},
		"too early":             {err: apiFailure(http.StatusTooEarly), retryable: true},
		"not implemented":       {err: apiFailure(http.StatusNotImplemented), retryable: false},
		"throttled":             {err: apiFailure(http.StatusTooManyRequests), retryable: true},
		"authentication failed": {err: apiFailure(http.StatusUnauthorized), retryable: true},
		"rejected content":      {err: apiFailure(http.StatusUnprocessableEntity), retryable: false},
		"forbidden":             {err: apiFailure(http.StatusForbidden), retryable: false},
		"cancelled":             {err: context.Canceled, retryable: false},
	} {
		if got := IsRetryable(test.err); got != test.retryable {
			t.Fatalf("%s: IsRetryable = %t, want %t", name, got, test.retryable)
		}
	}
}

func TestWrappedStatusesStayClassified(t *testing.T) {
	t.Parallel()
	wrapped := fmt.Errorf("ingest usage: %w", apiFailure(http.StatusUnprocessableEntity))
	if IsRetryable(wrapped) || isAuthenticationFailure(wrapped) {
		t.Fatalf("wrapped 422 classification is wrong: %v", wrapped)
	}
}

func TestSessionErrorsDistinguishEnrollmentFromOutages(t *testing.T) {
	t.Parallel()
	if !isEnrollmentRequired(apiFailure(http.StatusForbidden)) {
		t.Fatal("a forbidden session request did not require enrollment")
	}
	if isRetryableSessionError(apiFailure(http.StatusUnauthorized)) {
		t.Fatal("a rejected session credential was retried unchanged")
	}
	if !isRetryableSessionError(errors.New("connection reset")) {
		t.Fatal("a transport failure was treated as a definitive rejection")
	}
}
