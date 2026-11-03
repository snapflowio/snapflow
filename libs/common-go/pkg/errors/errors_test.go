// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package errors

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
)

func TestTypedErrorsCarryStatus(t *testing.T) {
	cause := errors.New("context missing")
	notFound := fmt.Errorf("delete: %w", NewNotFoundError(cause))
	if !IsNotFoundError(notFound) || IsRequestTimeoutError(notFound) {
		t.Fatal("wrapped not-found error must be recognised by type")
	}
	if IsNotFoundError(errors.New("file not found")) {
		t.Fatal("plain errors must not be classified by message text")
	}
	if !IsRequestTimeoutError(NewRequestTimeoutError(cause)) {
		t.Fatal("request timeout error must be recognised")
	}
	var httpErr *HTTPError
	if !errors.As(NewConflictError(cause), &httpErr) || httpErr.StatusCode != http.StatusConflict || httpErr.Code != codeConflict {
		t.Fatalf("conflict error = %+v", httpErr)
	}
}

func TestBadRequestExtractsUserLookupFailure(t *testing.T) {
	err := NewBadRequestError(errors.New("unable to find user alice: no such user"))
	if err.Error() != "bad request: unable to find user alice" {
		t.Fatalf("message = %q", err.Error())
	}
}

func TestStatusCodeName(t *testing.T) {
	if got := statusCodeName(http.StatusRequestEntityTooLarge); got != "REQUEST_ENTITY_TOO_LARGE" {
		t.Fatalf("statusCodeName = %q", got)
	}
	if got := statusCodeName(0); got != unknownStatusCodeName {
		t.Fatalf("statusCodeName(0) = %q", got)
	}
}
