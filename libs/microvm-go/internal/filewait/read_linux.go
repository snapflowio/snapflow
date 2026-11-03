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

package filewait

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/sys/unix"
)

const inotifyBufferSize = 4096

func Read(ctx context.Context, path string, validate func([]byte) error) ([]byte, error) {
	if validate == nil {
		return nil, errors.New("file wait validator is required")
	}
	var result []byte
	err := wait(ctx, path, func() (bool, error) {
		data, readErr := os.ReadFile(path)
		if errors.Is(readErr, os.ErrNotExist) {
			return false, nil
		}
		if readErr != nil {
			return false, fmt.Errorf("read %s: %w", path, readErr)
		}
		if err := validate(data); err != nil {
			return false, err
		}
		result = data
		return true, nil
	})
	return result, err
}

func Exists(ctx context.Context, path string) error {
	return wait(ctx, path, func() (bool, error) {
		_, err := os.Stat(path)
		if err == nil {
			return true, nil
		}
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		return false, fmt.Errorf("stat %s: %w", path, err)
	})
}

func wait(ctx context.Context, path string, check func() (bool, error)) (returnErr error) {
	if strings.TrimSpace(path) == "" {
		return errors.New("file wait path is required")
	}
	watcher, err := newFileWatcher(ctx)
	if err != nil {
		return err
	}
	defer func() {
		returnErr = errors.Join(returnErr, watcher.close())
	}()
	for {
		ready, checkErr := check()
		if checkErr != nil || ready {
			return checkErr
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := watcher.awaitChange(ctx, path); err != nil {
			return err
		}
	}
}

func (watcher *fileWatcher) awaitChange(ctx context.Context, path string) error {
	directory, err := nearestExistingDirectory(filepath.Dir(path))
	if err != nil {
		return err
	}
	moved, err := watcher.watch(directory)
	if err != nil || moved {
		return err
	}
	return watcher.await(ctx)
}

type fileWatcher struct {
	notify        int
	cancelPipe    [2]int
	directory     string
	descriptor    int
	pollFDs       []unix.PollFd
	buffer        []byte
	done          chan struct{}
	cancelResults chan error
	cancelWait    sync.WaitGroup
}

func newFileWatcher(ctx context.Context) (*fileWatcher, error) {
	notify, err := unix.InotifyInit1(unix.IN_CLOEXEC)
	if err != nil {
		return nil, fmt.Errorf("initialize file notification: %w", err)
	}
	watcher := &fileWatcher{
		notify:        notify,
		descriptor:    -1,
		buffer:        make([]byte, inotifyBufferSize),
		done:          make(chan struct{}),
		cancelResults: make(chan error, 1),
	}
	if err := unix.Pipe2(watcher.cancelPipe[:], unix.O_CLOEXEC|unix.O_NONBLOCK); err != nil {
		return nil, errors.Join(fmt.Errorf("create file wait cancellation pipe: %w", err), unix.Close(notify))
	}
	watcher.pollFDs = []unix.PollFd{
		{Fd: int32(notify), Events: unix.POLLIN},
		{Fd: int32(watcher.cancelPipe[0]), Events: unix.POLLIN},
	}
	watcher.cancelWait.Go(func() { watcher.signalCancellation(ctx) })
	return watcher, nil
}

func (watcher *fileWatcher) signalCancellation(ctx context.Context) {
	select {
	case <-ctx.Done():
		written, err := unix.Write(watcher.cancelPipe[1], []byte{1})
		switch {
		case err != nil:
			watcher.cancelResults <- fmt.Errorf("signal file wait cancellation: %w", err)
		case written != 1:
			watcher.cancelResults <- fmt.Errorf("signal file wait cancellation: wrote %d bytes", written)
		default:
			watcher.cancelResults <- nil
		}
	case <-watcher.done:
	}
}

func (watcher *fileWatcher) close() error {
	close(watcher.done)
	watcher.cancelWait.Wait()
	return errors.Join(
		unix.Close(watcher.cancelPipe[0]),
		unix.Close(watcher.cancelPipe[1]),
		unix.Close(watcher.notify),
	)
}

func (watcher *fileWatcher) watch(directory string) (bool, error) {
	if directory == watcher.directory {
		return false, nil
	}
	if watcher.descriptor >= 0 {
		if _, err := unix.InotifyRmWatch(watcher.notify, uint32(watcher.descriptor)); err != nil && !errors.Is(err, unix.EINVAL) {
			return false, fmt.Errorf("replace file notification watch for %s: %w", watcher.directory, err)
		}
	}
	descriptor, err := unix.InotifyAddWatch(watcher.notify, directory, unix.IN_ATTRIB|unix.IN_CLOSE_WRITE|unix.IN_CREATE|unix.IN_MOVED_TO)
	if err != nil {
		return false, fmt.Errorf("watch %s: %w", directory, err)
	}
	watcher.descriptor = descriptor
	watcher.directory = directory
	return true, nil
}

func (watcher *fileWatcher) await(ctx context.Context) error {
	eventCount, err := unix.Poll(watcher.pollFDs, -1)
	if errors.Is(err, unix.EINTR) || (err == nil && eventCount == 0) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("poll file notification: %w", err)
	}
	if watcher.pollFDs[1].Revents&unix.POLLIN != 0 {
		return errors.Join(ctx.Err(), <-watcher.cancelResults)
	}
	if watcher.pollFDs[0].Revents&unix.POLLIN == 0 {
		return nil
	}
	if _, err := unix.Read(watcher.notify, watcher.buffer); err != nil && !errors.Is(err, unix.EAGAIN) && !errors.Is(err, unix.EINTR) {
		return fmt.Errorf("read file notification: %w", err)
	}
	return nil
}

func nearestExistingDirectory(path string) (string, error) {
	directory := filepath.Clean(path)
	for {
		info, err := os.Stat(directory)
		if err == nil {
			if !info.IsDir() {
				return "", fmt.Errorf("file wait parent %s is not a directory", directory)
			}
			return directory, nil
		}
		if !errors.Is(err, os.ErrNotExist) {
			return "", fmt.Errorf("inspect file wait directory %s: %w", directory, err)
		}
		parent := filepath.Dir(directory)
		if parent == directory {
			return "", fmt.Errorf("no existing directory contains %s", path)
		}
		directory = parent
	}
}
