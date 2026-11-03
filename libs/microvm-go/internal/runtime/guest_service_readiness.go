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
	"net/http"
	"time"

	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/internal/exitinfo"
	"github.com/snapflowio/microvm-go/internal/lifecycle"
	"github.com/snapflowio/microvm-go/internal/socketdial"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/vsock"
)

const guestServiceReadinessTimeout = 15 * time.Second

const guestConsoleTailBytes = 2048

func (b *Backend) waitForGuestServicesReady(ctx context.Context, metadata state.InstanceMetadata) error {
	return runLifecycleAction(b, metadata.ID, lifecycle.OperationToolboxReady, func() error {
		return b.waitForGuestServicesReadyPhase(ctx, metadata)
	})
}

func (b *Backend) waitForGuestServicesReadyPhase(ctx context.Context, metadata state.InstanceMetadata) error {
	services := healthCheckedServices(metadata.GuestServices)
	if len(services) == 0 {
		return nil
	}
	readinessCtx, cancel := context.WithTimeout(ctx, guestServiceReadinessTimeout)
	defer cancel()

	if err := retryGuestOperation(
		readinessCtx,
		func() error { return probeGuestServices(readinessCtx, metadata, services) },
		retryEveryError,
	); err != nil {
		return fmt.Errorf("wait for guest service readiness: %w%s", err, b.guestConsoleExcerpt(metadata.ID))
	}
	return nil
}

func (b *Backend) guestConsoleExcerpt(instanceID string) string {
	tail, err := exitinfo.ReadTail(b.paths.InstanceAppLog(instanceID), guestConsoleTailBytes)
	if err != nil || len(tail) == 0 {
		return ""
	}
	return "\nguest console (tail):\n" + string(tail)
}

func healthCheckedServices(services []guest.Service) []guest.Service {
	result := make([]guest.Service, 0, len(services))
	for _, service := range services {
		if service.HealthPath != "" {
			result = append(result, service)
		}
	}
	return result
}

func probeGuestServices(ctx context.Context, metadata state.InstanceMetadata, services []guest.Service) error {
	for _, service := range services {
		if err := probeGuestService(ctx, metadata, service); err != nil {
			return fmt.Errorf("probe guest service %q: %w", service.Name, err)
		}
	}
	return nil
}

func probeGuestService(ctx context.Context, metadata state.InstanceMetadata, service guest.Service) error {
	client := &http.Client{Transport: socketdial.HTTPTransport(vsock.Endpoint(metadata.VsockSocket, int(service.Port)))}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+service.Name+".guest.internal"+service.HealthPath, nil)
	if err != nil {
		return fmt.Errorf("create health request: %w", err)
	}
	if service.AuthHeader != "" {
		token := metadata.GuestServiceTokens[service.Name]
		if token == "" {
			return fmt.Errorf("guest service credential is unavailable")
		}
		request.Header.Set(service.AuthHeader, service.AuthorizationValue(token))
	}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("send health request: %w", err)
	}
	closeErr := response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return errors.Join(fmt.Errorf("health request returned %s", response.Status), closeErr)
	}
	if closeErr != nil {
		return fmt.Errorf("close health response: %w", closeErr)
	}
	return nil
}
