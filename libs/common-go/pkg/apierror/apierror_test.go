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

package apierror

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"
)

type testResult struct {
	status int
	body   []byte
	value  *string
}

func (result testResult) StatusCode() int { return result.status }

func (result testResult) GetBody() []byte { return result.body }

func payload(result testResult) *string { return result.value }

func TestRetryableStatus(t *testing.T) {
	retryable := map[int]bool{
		http.StatusRequestTimeout:      true,
		http.StatusTooEarly:            true,
		http.StatusTooManyRequests:     true,
		http.StatusInternalServerError: true,
		http.StatusBadGateway:          true,
		http.StatusServiceUnavailable:  true,
		http.StatusGatewayTimeout:      true,
	}
	for status := http.StatusContinue; status <= http.StatusNetworkAuthenticationRequired; status++ {
		if got := RetryableStatus(status); got != retryable[status] {
			t.Fatalf("RetryableStatus(%d) = %v, want %v", status, got, retryable[status])
		}
	}
}

func TestCheckResponse(t *testing.T) {
	if err := CheckResponse("get", testResult{status: http.StatusNoContent}, nil); err != nil {
		t.Fatalf("CheckResponse(204) error = %v", err)
	}
	err := CheckResponse("get", testResult{
		status: http.StatusConflict,
		body:   []byte(`{"message":["first","second"],"error":"Conflict"}`),
	}, nil)
	var apiErr *Error
	if !errors.As(err, &apiErr) {
		t.Fatalf("CheckResponse() error = %T, want *Error", err)
	}
	if apiErr.Detail != "first; second" {
		t.Fatalf("Detail = %q", apiErr.Detail)
	}
	if !IsPermanent(err) || IsRetryable(err) || !HasStatus(err, http.StatusConflict) {
		t.Fatal("409 must be permanent with status 409")
	}
	fallback := CheckResponse("get", testResult{status: http.StatusBadGateway, body: []byte(`{"error":" Bad Gateway "}`)}, nil)
	if !IsRetryable(fallback) || IsPermanent(fallback) {
		t.Fatal("502 must be retryable")
	}
	if !strings.Contains(fallback.Error(), "Bad Gateway") {
		t.Fatalf("Error() = %q", fallback.Error())
	}
}

func TestTransportFailures(t *testing.T) {
	transport := CheckResponse("get", testResult{}, errors.New("connection reset"))
	if !IsRetryable(transport) || IsPermanent(transport) {
		t.Fatal("transport failures must be retryable")
	}
	if _, found := StatusOf(transport); found {
		t.Fatal("transport failures carry no status")
	}
	cancelled := CheckResponse("get", testResult{}, fmt.Errorf("dial: %w", context.Canceled))
	if IsRetryable(cancelled) {
		t.Fatal("cancellation must not be retryable")
	}
	if !errors.Is(cancelled, context.Canceled) {
		t.Fatal("cause must be unwrappable")
	}
}

func TestDecode(t *testing.T) {
	value := "ok"
	decoded, err := Decode("get", testResult{status: http.StatusOK, value: &value}, nil, payload)
	if err != nil || *decoded != value {
		t.Fatalf("Decode() = %v, %v", decoded, err)
	}
	if _, err := Decode("get", testResult{status: http.StatusOK}, nil, payload); err == nil {
		t.Fatal("Decode() accepted an empty payload")
	}
}

func TestDetailIsBounded(t *testing.T) {
	long := strings.Repeat("x", maximumDetailLength*2)
	err := CheckResponse("get", testResult{status: http.StatusBadRequest, body: []byte(`{"message":"` + long + `"}`)}, nil)
	var apiErr *Error
	if !errors.As(err, &apiErr) || len(apiErr.Detail) != maximumDetailLength {
		t.Fatalf("detail length = %d", len(apiErr.Detail))
	}
}

func TestParseRetryAfter(t *testing.T) {
	now := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	cases := map[string]time.Duration{
		"":               0,
		"5":              5 * time.Second,
		"-1":             0,
		"99999999999999": maximumRetryAfter,
		"garbage":        0,
		now.Add(time.Minute).Format(http.TimeFormat):  time.Minute,
		now.Add(-time.Minute).Format(http.TimeFormat): 0,
	}
	for value, want := range cases {
		if got := ParseRetryAfter(value, now); got != want {
			t.Fatalf("ParseRetryAfter(%q) = %v, want %v", value, got, want)
		}
	}
}
