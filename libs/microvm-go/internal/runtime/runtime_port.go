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
	"net/http"
	"os"
	"strings"

	mvmerrors "github.com/snapflowio/microvm-go/internal/errors"
	"github.com/snapflowio/microvm-go/internal/state"
	"github.com/snapflowio/microvm-go/types"
)

func (b *Backend) DialRuntimePort(
	ctx context.Context,
	instanceID string,
	target types.RuntimePortTarget,
) (net.Conn, error) {
	if err := target.Validate(); err != nil {
		return nil, err
	}
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
	if metadata.Network == nil || strings.TrimSpace(metadata.VsockSocket) == "" {
		return nil, mvmerrors.New(
			http.StatusServiceUnavailable,
			"runtime network is unavailable until the microVM is running",
			"MICROVM_RUNTIME_NETWORK_UNAVAILABLE",
		)
	}
	return b.networks.DialGuest(ctx, *metadata.Network, string(target.Protocol), int(target.Port))
}
