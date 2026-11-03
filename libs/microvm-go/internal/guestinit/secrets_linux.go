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

//go:build linux

package guestinit

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"github.com/snapflowio/microvm-go/internal/filewait"
	"github.com/snapflowio/microvm-go/internal/guest/control"
)

const secretEnvironmentWaitTimeout = 30 * time.Second

func waitForSecretEnvironment(ctx context.Context, cfg *Config) (map[string]string, error) {
	if !cfg.RequireSecretEnv {
		return nil, nil
	}
	waitContext, cancel := context.WithTimeout(ctx, secretEnvironmentWaitTimeout)
	defer cancel()
	values := map[string]string{}
	data, err := filewait.Read(waitContext, control.WorkloadSecretsPath, func(data []byte) error {
		if err := json.Unmarshal(data, &values); err != nil {
			return fmt.Errorf("decode secret environment: %w", err)
		}
		if err := (control.ApplySecretsRequest{Values: values}).Validate(); err != nil {
			return fmt.Errorf("validate secret environment: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("wait for secret environment: %w", err)
	}
	digest := sha256.Sum256(data)
	if err := atomicfile.Replace(control.WorkloadSecretsAppliedPath, digest[:], filemode.PrivateFile); err != nil {
		return nil, fmt.Errorf("acknowledge consumed secret environment: %w", err)
	}
	if err := atomicfile.Commit(control.WorkloadSecretsAppliedPath); err != nil {
		return nil, fmt.Errorf("acknowledge consumed secret environment: %w", err)
	}
	if err := os.Remove(control.WorkloadSecretsPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("remove consumed secret environment: %w", err)
	}
	return values, nil
}
