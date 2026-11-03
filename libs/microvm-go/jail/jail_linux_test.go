// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the license at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

//go:build linux

package jail

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/snapflowio/microvm-go/cputopology"
)

const (
	isolationTestEnvironment = "SNAPFLOW_ISOLATION_TEST"
	probeUID                 = 1<<30 + 4242
	probeHold                = 3 * time.Second
	probeTimeout             = 20 * time.Second
	statusCapabilities       = "CapEff:"
	statusNoNewPrivileges    = "NoNewPrivs:"
	allCapabilitiesCleared   = "0000000000000000"
	noNewPrivilegesSet       = "1"
	probeDiskBytesPerSecond  = 64 << 20
	probeDiskOperations      = 1000
	peerID                   = "jail-test-peer"
	peerSleep                = "30"
	cgroupRoot               = "/sys/fs/cgroup"
	cgroupUnifiedPrefix      = "0::"
	effectiveCPUsFile        = "cpuset.cpus.effective"
	ioMaxFile                = "io.max"
	// probeArgument re-executes the test binary as the jailed probe; the two
	// arguments after it are the writable and read-only bind paths.
	probeArgument      = "-jail-probe"
	probeArgumentCount = 2
)

// probeReport is what a process sees from inside its jail.
type probeReport struct {
	UID             int      `json:"uid"`
	GID             int      `json:"gid"`
	Capabilities    string   `json:"capabilities"`
	NoNewPrivileges string   `json:"noNewPrivileges"`
	RootEntries     []string `json:"rootEntries"`
	HostPasswd      bool     `json:"hostPasswd"`
	WritableFile    bool     `json:"writableFile"`
	ReadOnlyRefused bool     `json:"readOnlyRefused"`
}

func TestMain(m *testing.M) {
	Init()
	if len(os.Args) > 1 && os.Args[1] == probeArgument {
		os.Exit(runProbe(os.Args[2:]))
	}
	os.Exit(m.Run())
}

func runProbe(arguments []string) int {
	report := probeReport{UID: os.Getuid(), GID: os.Getgid()}
	status, err := os.Open("/proc/self/status")
	if err != nil {
		return 1
	}
	scanner := bufio.NewScanner(status)
	for scanner.Scan() {
		line := scanner.Text()
		if value, ok := strings.CutPrefix(line, statusCapabilities); ok {
			report.Capabilities = strings.TrimSpace(value)
		}
		if value, ok := strings.CutPrefix(line, statusNoNewPrivileges); ok {
			report.NoNewPrivileges = strings.TrimSpace(value)
		}
	}
	if err := status.Close(); err != nil {
		return 1
	}
	entries, err := os.ReadDir("/")
	if err != nil {
		return 1
	}
	for _, entry := range entries {
		report.RootEntries = append(report.RootEntries, entry.Name())
	}
	_, passwdErr := os.Stat("/etc/passwd")
	report.HostPasswd = passwdErr == nil
	if len(arguments) == probeArgumentCount {
		report.WritableFile = os.WriteFile(filepath.Join(arguments[0], "probe"), []byte("ok"), 0o600) == nil
		report.ReadOnlyRefused = os.WriteFile(filepath.Join(arguments[1], "probe"), []byte("no"), 0o600) != nil
	}
	if err := json.NewEncoder(os.Stdout).Encode(report); err != nil {
		return 1
	}
	time.Sleep(probeHold)
	return 0
}

func requireIsolationHost(t *testing.T) {
	t.Helper()
	if os.Getenv(isolationTestEnvironment) == "" || os.Geteuid() != 0 {
		t.Skipf("needs root and %s=1", isolationTestEnvironment)
	}
}

func TestJailedProcessSeesOnlyItsBindsAndHoldsNoPrivileges(t *testing.T) {
	requireIsolationHost(t)
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	work := t.TempDir()
	writable, readOnly := filepath.Join(work, "writable"), filepath.Join(work, "readonly")
	for _, directory := range []string{writable, readOnly} {
		if err := os.Mkdir(directory, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	output, err := os.Create(filepath.Join(work, "probe.json"))
	if err != nil {
		t.Fatal(err)
	}
	spec := Spec{
		ID: "jail-test", Root: filepath.Join(work, "root"), UID: probeUID, GID: probeUID,
		Executable: executable, Arguments: []string{probeArgument, writable, readOnly},
		ReadOnly: []string{readOnly}, Writable: []string{writable},
		Devices: []string{"/dev/urandom"}, OpenFiles: 1024,
	}
	command, err := Command(t.Context(), spec, output)
	if err != nil {
		t.Fatal(err)
	}
	if err := Start(command, spec); err != nil {
		t.Fatal(err)
	}
	limits := Limits{
		CPUs: 1, MemoryBytes: 256 << 20, Tasks: 64,
		DiskPath: work, DiskBytesPerSecond: probeDiskBytesPerSecond, DiskOperationsPerSecond: probeDiskOperations,
	}
	if err := Place(t.Context(), spec.ID, command.Process.Pid, limits); err != nil {
		t.Fatalf("place probe in a systemd scope: %v", err)
	}
	cgroup := scopeCgroup(t, command.Process.Pid)
	if !strings.Contains(cgroup, Slice) || !strings.Contains(cgroup, ScopeName(spec.ID)) {
		t.Fatalf("probe cgroup = %q, want a scope in %s", cgroup, Slice)
	}
	probeCPUs := assertWholeCore(t, cgroup)
	assertDiskCaps(t, cgroup)
	assertPeerTakesAnotherCore(t, probeCPUs)
	done := make(chan error, 1)
	go func() { done <- command.Wait() }()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("probe failed: %v", err)
		}
	case <-time.After(probeTimeout):
		t.Fatal("probe did not finish")
	}
	if err := output.Close(); err != nil {
		t.Fatal(err)
	}
	assertProbeReport(t, filepath.Join(work, "probe.json"), spec)
}

func assertProbeReport(t *testing.T, path string, spec Spec) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var report probeReport
	if err := json.Unmarshal(data, &report); err != nil {
		t.Fatalf("decode probe output %q: %v", data, err)
	}
	if report.UID != int(spec.UID) || report.GID != int(spec.GID) {
		t.Fatalf("probe ran as %d:%d, want %d:%d", report.UID, report.GID, spec.UID, spec.GID)
	}
	if report.Capabilities != allCapabilitiesCleared || report.NoNewPrivileges != noNewPrivilegesSet {
		t.Fatalf("probe kept privileges: CapEff %s NoNewPrivs %s", report.Capabilities, report.NoNewPrivileges)
	}
	if report.HostPasswd {
		t.Fatal("probe could see the host's /etc/passwd")
	}
	for _, entry := range report.RootEntries {
		if !slices.Contains([]string{"dev", "proc", "tmp", "home", "root", "opt", "var", "usr"}, entry) {
			t.Fatalf("unexpected entry %q in the jail root: %v", entry, report.RootEntries)
		}
	}
	if !report.WritableFile || !report.ReadOnlyRefused {
		t.Fatalf("bind access wrong: writable %t, read-only refused %t", report.WritableFile, report.ReadOnlyRefused)
	}
}

// scopeCgroup is the cgroup v2 directory that holds pid.
func scopeCgroup(t *testing.T, pid int) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("/proc", strconv.Itoa(pid), "cgroup"))
	if err != nil {
		t.Fatal(err)
	}
	for line := range strings.Lines(string(data)) {
		if path, ok := strings.CutPrefix(strings.TrimSpace(line), cgroupUnifiedPrefix); ok {
			return filepath.Join(cgroupRoot, path)
		}
	}
	t.Fatalf("no cgroup v2 entry in %q", data)
	return ""
}

func scopeCPUs(t *testing.T, cgroup string) []int {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(cgroup, effectiveCPUsFile))
	if err != nil {
		t.Fatal(err)
	}
	cpus, err := cputopology.ParseList(string(data))
	if err != nil {
		t.Fatal(err)
	}
	return cpus
}

// assertWholeCore checks the scope runs on exactly the SMT siblings of one
// physical core, so a one-vCPU tenant never shares a core.
func assertWholeCore(t *testing.T, cgroup string) []int {
	t.Helper()
	cpus := scopeCPUs(t, cgroup)
	cores, err := cputopology.Cores()
	if err != nil {
		t.Fatal(err)
	}
	if !slices.ContainsFunc(cores, func(core []int) bool { return slices.Equal(core, cpus) }) {
		t.Fatalf("scope CPUs %v are not one whole core of %v", cpus, cores)
	}
	return cpus
}

func assertDiskCaps(t *testing.T, cgroup string) {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(cgroup, ioMaxFile))
	if err != nil {
		t.Fatal(err)
	}
	want := fmt.Sprintf("rbps=%d wbps=%d riops=%d wiops=%d",
		probeDiskBytesPerSecond, probeDiskBytesPerSecond, probeDiskOperations, probeDiskOperations)
	if !strings.Contains(string(data), want) {
		t.Fatalf("io.max = %q, want a device capped at %q", data, want)
	}
}

// assertPeerTakesAnotherCore places a second process while the probe holds
// its core and checks the two scopes share no CPU.
func assertPeerTakesAnotherCore(t *testing.T, held []int) {
	t.Helper()
	peer := exec.CommandContext(t.Context(), "sleep", peerSleep)
	if err := peer.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := peer.Process.Kill(); err != nil {
			t.Errorf("stop peer: %v", err)
		}
		if err := peer.Wait(); err == nil {
			t.Error("peer exited cleanly after being killed")
		}
	})
	if err := Place(t.Context(), peerID, peer.Process.Pid, Limits{CPUs: 1}); err != nil {
		t.Fatalf("place peer in a systemd scope: %v", err)
	}
	cpus := scopeCPUs(t, scopeCgroup(t, peer.Process.Pid))
	if slices.ContainsFunc(cpus, func(cpu int) bool { return slices.Contains(held, cpu) }) {
		t.Fatalf("peer CPUs %v overlap the probe's core %v", cpus, held)
	}
}
