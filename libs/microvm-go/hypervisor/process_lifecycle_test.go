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

package hypervisor

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestPIDRecordBindsPIDToProcessIdentity(t *testing.T) {
	command := exec.CommandContext(t.Context(), "sleep", "10")
	if err := command.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		killErr := command.Process.Kill()
		if killErr != nil && !errors.Is(killErr, os.ErrProcessDone) {
			t.Errorf("kill test process: %v", killErr)
		}
		waitErr := command.Wait()
		var exitErr *exec.ExitError
		if waitErr != nil && !errors.As(waitErr, &exitErr) {
			t.Errorf("reap test process: %v", waitErr)
		}
	})
	process, err := IdentifyProcess(command.Process.Pid)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "vmm.pid")
	if err := WritePID(path, process); err != nil {
		t.Fatal(err)
	}
	recorded, err := ReadPID(path)
	if err != nil {
		t.Fatal(err)
	}
	if recorded.PID != command.Process.Pid || recorded.StartToken != process.StartToken {
		t.Fatalf("recorded process = %+v, want %+v", recorded, process)
	}
}

func TestTerminateDoesNotSignalAProcessWithAnotherIdentity(t *testing.T) {
	command := exec.CommandContext(t.Context(), "sleep", "10")
	if err := command.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		killErr := command.Process.Kill()
		if killErr != nil && !errors.Is(killErr, os.ErrProcessDone) {
			t.Errorf("kill test process: %v", killErr)
		}
		waitErr := command.Wait()
		var exitErr *exec.ExitError
		if waitErr != nil && !errors.As(waitErr, &exitErr) {
			t.Errorf("reap test process: %v", waitErr)
		}
	})
	reused := Process{PID: command.Process.Pid, StartToken: "an earlier process"}
	if reused.Running() {
		t.Fatal("a process with a different start identity was reported as running")
	}
	if err := Terminate(reused, processKillWait); err != nil {
		t.Fatal(err)
	}
	live, err := IdentifyProcess(command.Process.Pid)
	if err != nil {
		t.Fatalf("unrelated process was signalled: %v", err)
	}
	if !live.Running() {
		t.Fatal("unrelated process was terminated")
	}
}

func TestReadPIDRejectsUnstructuredPlainPID(t *testing.T) {
	path := filepath.Join(t.TempDir(), "vmm.pid")
	if err := os.WriteFile(path, []byte("1234\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := ReadPID(path); err == nil {
		t.Fatal("unstructured plain PID was trusted")
	}
}
