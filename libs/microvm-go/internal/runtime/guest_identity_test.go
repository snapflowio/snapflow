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

package runtime

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"testing"

	"github.com/snapflowio/microvm-go/internal/vsock"
)

func TestInstanceIdentityIsStableAndValid(t *testing.T) {
	id := "db4262b6-2109-489b-8822-2aa94bcb9eed"
	if got := instanceMachineID(id); len(got) != 32 || got != instanceMachineID(id) {
		t.Fatalf("invalid machine ID %q", got)
	}
	if got := instanceHostname(id); got != "snapflow-db4262b62109" {
		t.Fatalf("hostname = %q", got)
	}
}

func TestRetryVsockHandshakeRetriesOnlyClosedHandshake(t *testing.T) {
	calls := 0
	err := retryVsockHandshake(context.Background(), func(context.Context) error {
		calls++
		if calls < 3 {
			return fmt.Errorf("transient resume connection: %w", vsock.ErrHandshakeClosed)
		}
		return nil
	})
	if err != nil || calls != 3 {
		t.Fatalf("retryVsockHandshake() calls=%d err=%v", calls, err)
	}

	permanent := errors.New("request was rejected")
	calls = 0
	err = retryVsockHandshake(context.Background(), func(context.Context) error {
		calls++
		return permanent
	})
	if !errors.Is(err, permanent) || calls != 1 {
		t.Fatalf("permanent failure calls=%d err=%v", calls, err)
	}
}

func TestRetryableVsockHandshakeErrorAcceptsTransportTimeout(t *testing.T) {
	timeout := &net.DNSError{IsTimeout: true, Err: "guest transport not ready"}
	if !retryableVsockHandshakeError(fmt.Errorf("read vsock handshake: %w", timeout)) {
		t.Fatal("expected a wrapped transport timeout to be retryable")
	}
	if retryableVsockHandshakeError(errors.New("guest authentication failed")) {
		t.Fatal("expected a non-transport failure to remain terminal")
	}
	if !retryableVsockHandshakeError(fmt.Errorf("read vsock handshake: %w", os.ErrDeadlineExceeded)) {
		t.Fatal("expected a wrapped poll deadline to be retryable")
	}
}
