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

func TestNotFoundClassificationSurvivesWrapping(t *testing.T) {
	cause := errors.New("instance runtime-id")
	err := fmt.Errorf("load runtime: %w", NewNotFound(cause))

	var notFound *NotFoundError
	if !errors.As(err, &notFound) {
		t.Fatal("wrapped not-found error was not classified")
	}
	if !errors.Is(err, cause) {
		t.Fatal("wrapped not-found error did not preserve its cause")
	}

	var transport interface {
		HTTPStatusCode() int
		ErrorCode() string
	}
	if !errors.As(err, &transport) {
		t.Fatal("wrapped not-found error does not expose transport metadata")
	}
	if transport.HTTPStatusCode() != http.StatusNotFound || transport.ErrorCode() != "NOT_FOUND" {
		t.Fatalf(
			"transport metadata = (%d, %q), want (%d, %q)",
			transport.HTTPStatusCode(),
			transport.ErrorCode(),
			http.StatusNotFound,
			"NOT_FOUND",
		)
	}
}

func TestInvalidRequestPreservesCause(t *testing.T) {
	cause := errors.New("invalid runtime shape")
	err := NewInvalidRequest(cause)

	if !errors.Is(err, cause) {
		t.Fatal("invalid-request error did not preserve its cause")
	}
}

func TestErrorPreservesCause(t *testing.T) {
	cause := errors.New("registry unavailable")
	err := NewWithCause(http.StatusServiceUnavailable, "platform bundle is unavailable", "PLATFORM_BUNDLE_FETCH_FAILED", cause)

	if !errors.Is(err, cause) {
		t.Fatal("transport error did not preserve its cause")
	}
	var transport interface {
		HTTPStatusCode() int
		ErrorCode() string
	}
	if !errors.As(err, &transport) {
		t.Fatalf("error does not expose its transport contract: %T", err)
	}
	if transport.HTTPStatusCode() != http.StatusServiceUnavailable || transport.ErrorCode() != "PLATFORM_BUNDLE_FETCH_FAILED" {
		t.Fatalf("unexpected transport metadata: status=%d code=%s", transport.HTTPStatusCode(), transport.ErrorCode())
	}
}
