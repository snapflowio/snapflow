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
	"net/url"
	"os"
	"slices"
	"strings"

	"github.com/snapflowio/microvm-go/guest"
	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/socketdial"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/internal/vsock"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) GuestServiceTarget(ctx context.Context, instanceID, serviceName string) (*types.ProxyTarget, error) {
	guard, err := b.lifecycle.ReadLock(ctx, instanceID)
	if err != nil {
		return nil, fmt.Errorf("acquire instance lifecycle read lock: %w", err)
	}
	defer guard.Release()
	metadata, err := state.ReadInstanceMetadata(b.paths, instanceID)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, mvmerrors.NewNotFound(fmt.Errorf("instance %s", instanceID))
		}
		return nil, err
	}
	if strings.TrimSpace(metadata.VsockSocket) == "" {
		return nil, mvmerrors.New(
			http.StatusServiceUnavailable,
			"guest service is unavailable until the microVM is running",
			"MICROVM_GUEST_SERVICE_UNAVAILABLE",
		)
	}
	index := slices.IndexFunc(metadata.GuestServices, func(service guest.Service) bool {
		return service.Name == serviceName
	})
	if index < 0 {
		return nil, mvmerrors.NewNotFound(fmt.Errorf("guest service %q for instance %s", serviceName, instanceID))
	}
	service := metadata.GuestServices[index]
	target, err := url.Parse("http://" + serviceName + ".guest.internal")
	if err != nil {
		return nil, fmt.Errorf("parse guest service URL: %w", err)
	}
	dialContext := vsock.Endpoint(metadata.VsockSocket, int(service.Port))
	transport := socketdial.HTTPTransport(dialContext)
	result := &types.ProxyTarget{
		URL:         target,
		Transport:   transport,
		DialContext: dialContext,
		Headers:     make(http.Header),
	}
	if service.Credential {
		token := metadata.GuestServiceTokens[serviceName]
		if strings.TrimSpace(token) == "" {
			return nil, mvmerrors.New(http.StatusServiceUnavailable, "guest service credential is unavailable", "MICROVM_GUEST_SERVICE_CREDENTIAL_UNAVAILABLE")
		}
		result.Credential = token
		if service.AuthHeader != "" {
			result.Headers.Set(service.AuthHeader, service.AuthorizationValue(token))
		}
	}
	return result, nil
}
