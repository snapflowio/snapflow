// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package tunnel

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/snapflowio/common-go/pkg/apierror"
)

func controlFailure(statusCode int) error {
	return fmt.Errorf("wrapped: %w", &apierror.Error{
		Operation: fetchPlanOperation, StatusCode: statusCode, Cause: errors.New("rejected"),
	})
}

func TestPermanentControlErrorKeepsRequestTimeoutPermanent(t *testing.T) {
	cases := []struct {
		name      string
		err       error
		permanent bool
	}{
		{name: "request timeout", err: controlFailure(http.StatusRequestTimeout), permanent: true},
		{name: "unauthorized", err: controlFailure(http.StatusUnauthorized), permanent: true},
		{name: "too many requests", err: controlFailure(http.StatusTooManyRequests), permanent: false},
		{name: "server error", err: controlFailure(http.StatusServiceUnavailable), permanent: false},
		{name: "transport failure", err: controlFailure(0), permanent: false},
		{name: "plain error", err: errors.New("dial failed"), permanent: false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := permanentControlError(testCase.err); got != testCase.permanent {
				t.Fatalf("permanentControlError() = %t, want %t", got, testCase.permanent)
			}
		})
	}
}

func TestFencedControlErrorMatchesConflictOnly(t *testing.T) {
	if !fencedControlError(controlFailure(http.StatusConflict)) {
		t.Fatal("HTTP 409 was not treated as a superseded fence")
	}
	if fencedControlError(controlFailure(http.StatusBadRequest)) {
		t.Fatal("HTTP 400 was treated as a superseded fence")
	}
}
