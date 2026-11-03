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

package guestcontrol

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestClientRejectsOversizedSuccessfulResponse(t *testing.T) {
	client := &Client{
		http: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(strings.Repeat("x", maxControlResponseBytes+1))),
				Header:     make(http.Header),
			}, nil
		})},
		token: "control-token",
	}

	err := client.PrepareFork(context.Background())
	if err == nil || !strings.Contains(err.Error(), "exceeds 65536 byte limit") {
		t.Fatalf("PrepareFork error = %v, want response size error", err)
	}
}

func TestStableHostSessionID(t *testing.T) {
	first := stableHostSessionID("first-control-token")
	if first != stableHostSessionID("first-control-token") {
		t.Fatal("same control token produced different host session IDs")
	}
	if first == stableHostSessionID("second-control-token") {
		t.Fatal("different control tokens produced the same host session ID")
	}
	if err := uuid.Validate(first); err != nil {
		t.Fatalf("stable host session ID is not a UUID: %v", err)
	}
}
