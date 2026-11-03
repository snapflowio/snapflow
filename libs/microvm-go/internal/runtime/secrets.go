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
	"time"

	"github.com/snapflowio/microvm-go/internal/guestcontrol"
	"github.com/snapflowio/microvm-go/internal/state"
)

const (
	secretInjectionTimeout       = 30 * time.Second
	secretInjectionRetryInterval = 100 * time.Millisecond
)

func (b *Backend) injectRuntimeSecretsWithClient(ctx context.Context, metadata state.InstanceMetadata, values map[string]string, client *guestcontrol.Client) error {
	if !metadata.RequiresSecretEnv {
		if len(values) > 0 {
			return errors.New("instance does not declare a secret environment")
		}
		return nil
	}
	if len(values) == 0 {
		return errors.New("instance requires secret environment values")
	}
	injectionCtx, cancel := context.WithTimeout(ctx, secretInjectionTimeout)
	defer cancel()
	ticker := time.NewTicker(secretInjectionRetryInterval)
	defer ticker.Stop()
	var lastErr error
	for {
		if err := client.ApplySecrets(injectionCtx, values); err == nil {
			return nil
		} else {
			lastErr = err
		}
		select {
		case <-injectionCtx.Done():
			return fmt.Errorf("inject instance secret environment: %w", errors.Join(injectionCtx.Err(), lastErr))
		case <-ticker.C:
		}
	}
}
