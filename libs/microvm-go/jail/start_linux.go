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
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"runtime"
	"syscall"

	"github.com/vishvananda/netns"
)

const (
	initArgument = "snapflow-jail-init"
	selfExecPath = "/proc/self/exe"
	rootDirMode  = 0o700
	// readableBits lets a jailed uid read and traverse shared read-only
	// assets; the jail's mount view, not file modes, keeps them private.
	readableBits   = 0o004
	executableBits = 0o001
	ownerExecBit   = 0o100
	cloneFlags     = syscall.CLONE_NEWNS | syscall.CLONE_NEWPID | syscall.CLONE_NEWIPC | syscall.CLONE_NEWUTS
)

// Command prepares host paths for spec and returns the command that runs the
// jail init; Start launches it inside the spec's network namespace. The VMM
// outlives the request that starts it, so ctx's cancellation never kills it.
func Command(ctx context.Context, spec Spec, output *os.File) (*exec.Cmd, error) {
	if err := spec.Validate(); err != nil {
		return nil, err
	}
	if err := prepareHostPaths(spec); err != nil {
		return nil, err
	}
	command := exec.CommandContext(context.WithoutCancel(ctx), selfExecPath)
	command.Args = []string{initArgument}
	command.Env = []string{}
	command.Stdout = output
	command.Stderr = output
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true, Cloneflags: cloneFlags}
	return command, nil
}

// Start runs command with the spec on its pipe. The VMM must outlive the
// caller, so nothing ties its lifetime to the starting goroutine.
func Start(command *exec.Cmd, spec Spec) error {
	payload, err := json.Marshal(spec)
	if err != nil {
		return fmt.Errorf("encode jail spec: %w", err)
	}
	reader, writer, err := os.Pipe()
	if err != nil {
		return fmt.Errorf("create jail spec pipe: %w", err)
	}
	command.ExtraFiles = []*os.File{reader}
	startErr := startInNamespace(command, spec.NetworkNamespace)
	closeErr := reader.Close()
	if startErr != nil {
		return errors.Join(startErr, closeErr, writer.Close())
	}
	_, writeErr := writer.Write(payload)
	return errors.Join(closeErr, writeErr, writer.Close())
}

// startInNamespace forks from a thread that has joined the target network
// namespace; the child inherits it. The thread is retired if it cannot return
// to the original namespace.
func startInNamespace(command *exec.Cmd, namespacePath string) error {
	if namespacePath == "" {
		return command.Start()
	}
	runtime.LockOSThread()
	origin, err := netns.Get()
	if err != nil {
		runtime.UnlockOSThread()
		return fmt.Errorf("read current network namespace: %w", err)
	}
	defer origin.Close()
	target, err := netns.GetFromPath(namespacePath)
	if err != nil {
		runtime.UnlockOSThread()
		return fmt.Errorf("open network namespace %s: %w", namespacePath, err)
	}
	defer target.Close()
	if err := netns.Set(target); err != nil {
		runtime.UnlockOSThread()
		return fmt.Errorf("join network namespace %s: %w", namespacePath, err)
	}
	startErr := command.Start()
	if err := netns.Set(origin); err != nil {
		return errors.Join(startErr, fmt.Errorf("return to the original network namespace: %w", err))
	}
	runtime.UnlockOSThread()
	return startErr
}

func prepareHostPaths(spec Spec) error {
	if err := os.MkdirAll(spec.Root, rootDirMode); err != nil {
		return fmt.Errorf("create jail root: %w", err)
	}
	for _, path := range spec.Writable {
		if err := os.Lchown(path, int(spec.UID), int(spec.GID)); err != nil {
			return fmt.Errorf("give jailed VMM %s: %w", path, err)
		}
	}
	for _, path := range append([]string{spec.Executable}, spec.ReadOnly...) {
		if err := ensureReadable(path); err != nil {
			return err
		}
	}
	for _, path := range spec.Devices {
		info, err := os.Stat(path)
		if err != nil {
			return fmt.Errorf("inspect jail device %s: %w", path, err)
		}
		if info.Mode()&fs.ModeCharDevice == 0 {
			return fmt.Errorf("%w: %s is not a character device", ErrInvalidSpec, path)
		}
	}
	return nil
}

func ensureReadable(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("inspect jail path %s: %w", path, err)
	}
	mode := info.Mode().Perm() | readableBits
	if info.IsDir() || info.Mode().Perm()&ownerExecBit != 0 {
		mode |= executableBits
	}
	if mode == info.Mode().Perm() {
		return nil
	}
	if err := os.Chmod(path, mode); err != nil {
		return fmt.Errorf("make %s readable to jailed VMMs: %w", path, err)
	}
	return nil
}
