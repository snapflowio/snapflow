// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/childreap"
)

const (
	testGracePeriod   = time.Second
	testCheckInterval = 10 * time.Millisecond
	testSessionID     = "build"
	concurrentCreates = 8
	sentinelFileName  = "keep"
	sentinelMode      = 0o600
)

func newTestService(t *testing.T) (*Service, string) {
	t.Helper()
	configDir := t.TempDir()
	service := New(Config{
		ConfigDir:                configDir,
		TerminationGracePeriod:   testGracePeriod,
		TerminationCheckInterval: testCheckInterval,
	}, Dependencies{Logger: slog.New(slog.DiscardHandler), Reaper: childreap.New()})
	t.Cleanup(func() {
		for _, id := range service.sessions.Keys() {
			if err := service.Delete(context.Background(), id); err != nil {
				t.Errorf("delete session %s: %v", id, err)
			}
		}
	})
	return service, configDir
}

func TestValidateIDRejectsPathTraversal(t *testing.T) {
	for _, id := range []string{"", ".", "..", "...", "../..", "a/b", `a\b`, "a b", strings.Repeat("a", maximumIDLength+1)} {
		if err := ValidateID(id); err == nil {
			t.Errorf("ValidateID(%q) accepted an unsafe identifier", id)
		}
	}
	for _, id := range []string{EntrypointID, EntrypointCommand, "build-1.2_x", strings.Repeat("a", maximumIDLength)} {
		if err := ValidateID(id); err != nil {
			t.Errorf("ValidateID(%q) = %v, want nil", id, err)
		}
	}
}

func TestDeleteRejectsTraversalWithoutRemovingFiles(t *testing.T) {
	service, configDir := newTestService(t)
	sentinel := filepath.Join(configDir, sentinelFileName)
	if err := os.WriteFile(sentinel, nil, sentinelMode); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"..", "../..", "../" + sentinelFileName} {
		err := service.Delete(context.Background(), id)
		var httpErr *common_errors.HTTPError
		if err == nil || !errors.As(err, &httpErr) {
			t.Fatalf("Delete(%q) error = %v, want a bad request", id, err)
		}
	}
	if _, err := os.Stat(sentinel); err != nil {
		t.Fatalf("a rejected delete removed files outside the sessions root: %v", err)
	}
}

func TestDirectoryStaysInsideTheSessionsRoot(t *testing.T) {
	service, configDir := newTestService(t)
	if _, err := service.directory(".."); err == nil {
		t.Fatal("directory accepted a path that escapes the sessions root")
	}
	path, err := service.directory(testSessionID, EntrypointCommand)
	if err != nil {
		t.Fatalf("directory() error = %v", err)
	}
	if want := filepath.Join(configDir, sessionsDirectory, testSessionID, EntrypointCommand); path != want {
		t.Fatalf("directory() = %q, want %q", path, want)
	}
}

func TestConcurrentCreateStartsOneShell(t *testing.T) {
	service, configDir := newTestService(t)
	var created sync.WaitGroup
	results := make(chan error, concurrentCreates)
	for range concurrentCreates {
		created.Go(func() { results <- service.Create(t.Context(), testSessionID) })
	}
	created.Wait()
	close(results)
	succeeded := 0
	for err := range results {
		if err == nil {
			succeeded++
		}
	}
	if succeeded != 1 {
		t.Fatalf("%d concurrent creates succeeded, want exactly one", succeeded)
	}
	if _, err := os.Stat(filepath.Join(configDir, sessionsDirectory, testSessionID)); err != nil {
		t.Fatalf("session directory was not created: %v", err)
	}
}

func TestExecuteSeparatesStreamsAndRecordsTheExitCode(t *testing.T) {
	service, _ := newTestService(t)
	if err := service.Create(t.Context(), testSessionID); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	execution, err := service.Execute(context.Background(), testSessionID, "", "echo out; echo err >&2; (exit 3)", false, false)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if execution.ExitCode != 3 || execution.Stdout != "out\n" || execution.Stderr != "err\n" {
		t.Fatalf("execution = %+v, want exit 3 with separated streams", execution)
	}
	command, err := service.GetCommand(testSessionID, execution.CommandID)
	if err != nil || command.ExitCode == nil || *command.ExitCode != 3 {
		t.Fatalf("GetCommand() = %+v, %v; want the recorded exit code", command, err)
	}
}

func TestExecuteHonoursTheRequestContext(t *testing.T) {
	service, _ := newTestService(t)
	if err := service.Create(t.Context(), testSessionID); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), testCheckInterval)
	defer cancel()
	if _, err := service.Execute(ctx, testSessionID, "", "sleep 5", false, false); err == nil {
		t.Fatal("Execute() kept waiting after the request context ended")
	}
}

func TestFollowStopsWhenTheCommandExits(t *testing.T) {
	service, _ := newTestService(t)
	if err := service.Create(t.Context(), testSessionID); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	execution, err := service.Execute(context.Background(), testSessionID, "", "echo first; sleep 0.2; echo second", true, true)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	stream, err := service.OpenCommandLog(testSessionID, execution.CommandID)
	if err != nil {
		t.Fatalf("OpenCommandLog() error = %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), testGracePeriod)
	defer cancel()
	var output []byte
	if err := stream.Follow(ctx, true, func(data []byte) error {
		output = append(output, data...)
		return nil
	}); err != nil {
		t.Fatalf("Follow() error = %v", err)
	}
	if ctx.Err() != nil {
		t.Fatal("Follow() only stopped at the deadline")
	}
	if stdout, stderr := Split(output); string(stdout) != "first\nsecond\n" || len(stderr) != 0 {
		t.Fatalf("followed stdout = %q, stderr = %q", stdout, stderr)
	}
}
