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
	"reflect"
	"testing"
)

func TestTransactionRollsBackInReverseOrderAndJoinsErrors(t *testing.T) {
	transaction := NewTransaction()
	var order []string
	if err := transaction.Defer("first", func(context.Context) error {
		order = append(order, "first")
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	sentinel := errors.New("sentinel")
	if err := transaction.Defer("second", func(context.Context) error {
		order = append(order, "second")
		return sentinel
	}); err != nil {
		t.Fatal(err)
	}
	err := transaction.Rollback(context.Background())
	if !errors.Is(err, sentinel) {
		t.Fatalf("Rollback() error = %v, want sentinel", err)
	}
	if !reflect.DeepEqual(order, []string{"second", "first"}) {
		t.Fatalf("rollback order = %v", order)
	}
}

func TestTransactionCommitPreventsRollback(t *testing.T) {
	transaction := NewTransaction()
	called := false
	if err := transaction.Defer("resource", func(context.Context) error {
		called = true
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	transaction.Commit()
	if err := transaction.Rollback(context.Background()); err != nil {
		t.Fatal(err)
	}
	if called {
		t.Fatal("rollback ran after commit")
	}
}
