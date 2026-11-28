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

package control

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/internal/socketdial"
)

const componentHookDialTimeout = 2 * time.Second

func NotifyComponent(ctx context.Context, hook guest.LifecycleHook, operation guest.LifecycleOperation, payload any) error {
	if !hook.Handles(operation) {
		return fmt.Errorf("component %q does not handle the %s lifecycle operation", hook.Name, operation)
	}
	return callComponentHooks(ctx, []guest.LifecycleHook{hook}, operation, payload)
}

func callComponentHooks(ctx context.Context, hooks []guest.LifecycleHook, operation guest.LifecycleOperation, payload any) error {
	var body []byte
	var err error
	if payload != nil {
		body, err = json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encode component lifecycle payload: %w", err)
		}
	}
	for _, hook := range hooks {
		if !hook.Handles(operation) {
			continue
		}
		transport := socketdial.HTTPTransport(socketdial.UnixWithTimeout(hook.SocketPath, componentHookDialTimeout))
		request, requestErr := http.NewRequestWithContext(ctx, http.MethodPost, "http://component.internal"+guest.LifecycleOperationPath(operation), bytes.NewReader(body))
		if requestErr != nil {
			return requestErr
		}
		request.Header.Set("Content-Type", "application/json")
		response, requestErr := (&http.Client{Transport: transport, Timeout: componentHookRequestTimeout}).Do(request)
		if requestErr != nil {
			return fmt.Errorf("notify component %q to %s: %w", hook.Name, operation, requestErr)
		}
		if err := response.Body.Close(); err != nil {
			return fmt.Errorf("close component %q %s response: %w", hook.Name, operation, err)
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			return fmt.Errorf("component %q rejected %s with status %d", hook.Name, operation, response.StatusCode)
		}
	}
	return nil
}
