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

package builds

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/moby/buildkit/client"
	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
)

const (
	tenantA = "org-a"
	tenantB = "org-b"
)

var errNoDaemon = errors.New("no BuildKit daemon in tests")

func poolTestTime() time.Time {
	return time.Date(2026, 10, 18, 12, 0, 0, 0, time.UTC)
}

type fakeBuilderMachine struct {
	mu      sync.Mutex
	started []BuilderSpec
	stopped []string
}

func (machine *fakeBuilderMachine) StartBuilder(ctx context.Context, spec BuilderSpec) (BuilderPhases, error) {
	machine.mu.Lock()
	defer machine.mu.Unlock()
	machine.started = append(machine.started, spec)
	return BuilderPhases{}, nil
}

func (machine *fakeBuilderMachine) DialBuilder(ctx context.Context, id string, port uint16) (net.Conn, error) {
	return nil, errNoDaemon
}

func (machine *fakeBuilderMachine) StopBuilder(ctx context.Context, id string) error {
	machine.mu.Lock()
	defer machine.mu.Unlock()
	machine.stopped = append(machine.stopped, id)
	return nil
}

func (machine *fakeBuilderMachine) ReserveBuildDisk(ctx context.Context, id string) error {
	return ctx.Err()
}

func (machine *fakeBuilderMachine) ReleaseBuildDisk(id string) {}

func (machine *fakeBuilderMachine) BuilderLogs(id string) BuilderLogs {
	return BuilderLogs{}
}

func newTestPool(t *testing.T, capacity int) (*builderPool, *fakeBuilderMachine) {
	t.Helper()
	machine := &fakeBuilderMachine{}
	pool := newBuilderPool(machine, layout.NewPaths(t.TempDir()), Config{MaxConcurrent: capacity}.Normalize())
	pool.now = func() time.Time { return poolTestTime() }
	pool.ready = func(context.Context, *client.Client) error { return nil }
	for _, tenant := range []string{tenantA, tenantB} {
		createStateDisk(t, pool, tenant, poolTestTime())
	}
	return pool, machine
}

func createStateDisk(t *testing.T, pool *builderPool, tenant string, usedAt time.Time) {
	t.Helper()
	path := pool.paths.SystemBuilderState(tenantKey(tenant))
	if err := os.MkdirAll(filepath.Dir(path), builderStateDirPermission); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, nil, outputPermission); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(path, usedAt, usedAt); err != nil {
		t.Fatal(err)
	}
}

func acquireAndRelease(t *testing.T, pool *builderPool, tenant string, config []byte) builderLease {
	t.Helper()
	lease, err := pool.acquire(t.Context(), tenant, config)
	if err != nil {
		t.Fatal(err)
	}
	pool.release(t.Context(), lease.builder, true)
	return lease
}

func TestBuilderPoolKeepsOneWarmBuilderPerOrganization(t *testing.T) {
	pool, machine := newTestPool(t, 2)
	first := acquireAndRelease(t, pool, tenantA, []byte("config"))
	second := acquireAndRelease(t, pool, tenantA, []byte("config"))
	other := acquireAndRelease(t, pool, tenantB, []byte("config"))
	if !first.cold || second.cold || first.builder != second.builder {
		t.Fatal("a second build of the same organization did not reuse its warm builder")
	}
	if other.builder == first.builder || len(machine.started) != 2 {
		t.Fatalf("organizations shared a builder: started %d builders", len(machine.started))
	}
	if machine.started[0].StateDisk == machine.started[1].StateDisk {
		t.Fatal("organizations share a BuildKit state disk")
	}
	if len(machine.stopped) != 0 {
		t.Fatalf("warm builders were stopped: %v", machine.stopped)
	}
}

func TestBuilderPoolEvictsTheLeastRecentlyUsedIdleBuilder(t *testing.T) {
	pool, machine := newTestPool(t, 1)
	first := acquireAndRelease(t, pool, tenantA, []byte("config"))
	acquireAndRelease(t, pool, tenantB, []byte("config"))
	if len(machine.stopped) != 1 || machine.stopped[0] != first.builder.id {
		t.Fatalf("stopped builders = %v, want the idle builder of %s", machine.stopped, tenantA)
	}
}

func TestBuilderPoolStopsIdleBuildersButNotActiveOnes(t *testing.T) {
	pool, machine := newTestPool(t, 2)
	idle := acquireAndRelease(t, pool, tenantA, []byte("config"))
	active, err := pool.acquire(t.Context(), tenantB, []byte("config"))
	if err != nil {
		t.Fatal(err)
	}
	pool.stopIdle(t.Context(), poolTestTime().Add(time.Second))
	if len(machine.stopped) != 1 || machine.stopped[0] != idle.builder.id {
		t.Fatalf("stopped builders = %v, want only the idle builder", machine.stopped)
	}
	pool.release(t.Context(), active.builder, true)
}

func TestBuilderPoolRestartsAnIdleBuilderWhenItsDaemonConfigurationChanges(t *testing.T) {
	pool, machine := newTestPool(t, 2)
	acquireAndRelease(t, pool, tenantA, []byte("config"))
	acquireAndRelease(t, pool, tenantA, []byte("changed"))
	if len(machine.started) != 2 || len(machine.stopped) != 1 {
		t.Fatalf("started %d, stopped %d builders, want a restart", len(machine.started), len(machine.stopped))
	}
	active, err := pool.acquire(t.Context(), tenantA, []byte("changed"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.acquire(t.Context(), tenantA, []byte("other")); !errors.Is(err, errBuilderReconfiguring) {
		t.Fatalf("acquire with a new configuration during a build = %v", err)
	}
	pool.release(t.Context(), active.builder, true)
}

func TestBuilderPoolDiscardsAnUnhealthyBuilder(t *testing.T) {
	pool, machine := newTestPool(t, 2)
	lease, err := pool.acquire(t.Context(), tenantA, []byte("config"))
	if err != nil {
		t.Fatal(err)
	}
	pool.release(t.Context(), lease.builder, false)
	if len(machine.stopped) != 1 {
		t.Fatal("an unhealthy builder stayed warm")
	}
	if next := acquireAndRelease(t, pool, tenantA, []byte("config")); !next.cold {
		t.Fatal("the next build reused a discarded builder")
	}
}

func TestBuilderStateRetentionRemovesExpiredAndExcessDisks(t *testing.T) {
	pool, _ := newTestPool(t, 2)
	expired := "org-expired"
	createStateDisk(t, pool, expired, poolTestTime().Add(-builderStateRetention-time.Hour))
	for index := range builderStateDiskLimit {
		createStateDisk(t, pool, fmt.Sprintf("org-recent-%d", index), poolTestTime().Add(-time.Duration(index+1)*time.Minute))
	}
	warm := acquireAndRelease(t, pool, tenantA, []byte("config"))
	if err := pool.pruneStateDisks(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(pool.paths.SystemBuilderState(tenantKey(expired))); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("an expired organization state disk was kept")
	}
	if _, err := os.Stat(pool.paths.SystemBuilderState(warm.builder.key)); err != nil {
		t.Fatalf("the state disk of a warm builder was removed: %v", err)
	}
	states, err := pool.listStates()
	if err != nil {
		t.Fatal(err)
	}
	if len(states) > builderStateDiskLimit+1 {
		t.Fatalf("%d state disks remain, want at most %d plus the warm builder", len(states), builderStateDiskLimit)
	}
}

func TestTenantKeysArePathSafeAndDistinct(t *testing.T) {
	traversal := tenantKey("../" + tenantA)
	if traversal == tenantKey(tenantA) || filepath.Base(traversal) != traversal {
		t.Fatalf("tenant key %q is not a distinct path element", traversal)
	}
}

func TestSessionCredentialsServeOnlyTheRequestRegistries(t *testing.T) {
	cache, err := resolveCacheRegistry(testCacheRegistry("https://cache.example.com", "transient/org-a/buildcache"), testGateway)
	if err != nil {
		t.Fatal(err)
	}
	credentials, err := newRegistryCredentials([]types.Registry{
		{URL: "https://private.example.com", Username: "user", Password: "secret"},
		{URL: "https://public.example.com"},
	}, cache)
	if err != nil {
		t.Fatal(err)
	}
	for host, wantUser := range map[string]string{
		"cache.example.com":   cache.username,
		"private.example.com": "user",
		"public.example.com":  "",
		"other.example.com":   "",
	} {
		auth, lookupErr := credentials.lookup(t.Context(), host, nil, nil)
		if lookupErr != nil || auth.Username != wantUser {
			t.Fatalf("credentials for %s = %q, %v; want %q", host, auth.Username, lookupErr, wantUser)
		}
	}
}
