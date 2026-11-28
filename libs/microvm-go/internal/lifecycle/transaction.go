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

package lifecycle

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

const compensationTimeout = 30 * time.Second

type Rollback func(context.Context) error

type rollbackStep struct {
	name string
	run  Rollback
}

type Transaction struct {
	mu         sync.Mutex
	steps      []rollbackStep
	committed  bool
	rolledBack bool
}

func NewTransaction() *Transaction {
	return &Transaction{}
}

func (t *Transaction) Defer(name string, rollback Rollback) error {
	if t == nil {
		return errors.New("lifecycle transaction is nil")
	}
	if rollback == nil {
		return errors.New("lifecycle rollback is required")
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.committed {
		return errors.New("lifecycle transaction is already committed")
	}
	if t.rolledBack {
		return errors.New("lifecycle transaction is already rolled back")
	}
	t.steps = append(t.steps, rollbackStep{name: name, run: rollback})
	return nil
}

func (t *Transaction) Commit() {
	if t == nil {
		return
	}
	t.mu.Lock()
	t.committed = true
	t.steps = nil
	t.mu.Unlock()
}

func (t *Transaction) Rollback(ctx context.Context) error {
	if t == nil {
		return nil
	}
	compensationCtx, cancelCompensation := context.WithTimeout(
		context.WithoutCancel(ctx),
		compensationTimeout,
	)
	defer cancelCompensation()
	t.mu.Lock()
	if t.committed || t.rolledBack {
		t.mu.Unlock()
		return nil
	}
	t.rolledBack = true
	steps := append([]rollbackStep(nil), t.steps...)
	t.steps = nil
	t.mu.Unlock()

	var rollbackErrors []error
	for i := len(steps) - 1; i >= 0; i-- {
		if err := steps[i].run(compensationCtx); err != nil {
			rollbackErrors = append(rollbackErrors, fmt.Errorf("rollback %s: %w", steps[i].name, err))
		}
	}
	return errors.Join(rollbackErrors...)
}
