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
	"log/slog"
	"time"

	"github.com/snapflowio/microvm-go/internal/logtrim"
	"github.com/snapflowio/microvm-go/internal/state"
)

const (
	consoleLogTrimInterval = time.Minute
	consoleLogMaxBytes     = 64 << 20
	consoleLogKeepBytes    = 16 << 20
)

func (b *Backend) superviseConsoleLogs(ctx context.Context) {
	ticker := time.NewTicker(consoleLogTrimInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		if err := b.trimConsoleLogs(); err != nil {
			slog.WarnContext(ctx, "could not cap microVM console logs", "error", err)
		}
	}
}

func (b *Backend) trimConsoleLogs() error {
	listing, err := state.ListInstances(b.paths)
	if err != nil {
		return fmt.Errorf("list instances for console log capping: %w", err)
	}
	var failures []error
	for _, instance := range listing.Instances {
		for _, path := range []string{b.paths.InstanceAppLog(instance.ID), b.paths.InstanceVMMLog(instance.ID)} {
			if err := logtrim.Trim(path, consoleLogMaxBytes, consoleLogKeepBytes); err != nil {
				failures = append(failures, err)
			}
		}
	}
	return errors.Join(failures...)
}
