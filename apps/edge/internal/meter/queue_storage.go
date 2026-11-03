// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"bytes"
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"github.com/snapflowio/common-go/pkg/atomicfile"
)

var errCorruptState = errors.New("edge usage state is corrupt")

type queueRecovery struct {
	CursorReset        bool
	DiscardedIntervals int
}

func (queue *intervalQueue) load() error {
	if err := queue.loadCursor(); err != nil {
		if !errors.Is(err, errCorruptState) {
			return err
		}
		if err := queue.resetCorruptState(); err != nil {
			return err
		}
	}
	queue.nextPosition = queue.cursor.Position + 1
	entries, err := os.ReadDir(queue.root)
	if err != nil {
		return fmt.Errorf("read Edge usage queue: %w", err)
	}
	removedStaleEntry := false
	for _, entry := range entries {
		removed, err := queue.loadEntry(entry)
		if err != nil {
			return err
		}
		removedStaleEntry = removedStaleEntry || removed
	}
	slices.SortFunc(queue.intervals, func(left, right queuedInterval) int {
		return cmp.Compare(left.position, right.position)
	})
	if removedStaleEntry {
		return atomicfile.SyncDirectory(queue.root)
	}
	return nil
}

func (queue *intervalQueue) loadEntry(entry os.DirEntry) (bool, error) {
	name := entry.Name()
	path := filepath.Join(queue.root, name)
	if name == cursorFilename {
		return false, nil
	}
	if strings.HasPrefix(name, incompleteEntryPrefix) {
		return true, removeEntry(path, "incomplete")
	}
	position, err := parseIntervalDirectoryPosition(name)
	if err != nil {
		return false, err
	}
	if !entry.IsDir() {
		return false, fmt.Errorf("edge usage interval %q is not a directory", name)
	}
	if position <= queue.cursor.Position {
		return true, removeEntry(path, "acknowledged")
	}
	_, metadata, err := queue.readInterval(path)
	if errors.Is(err, errCorruptState) {
		queue.recovery.DiscardedIntervals++
		return true, removeEntry(path, "corrupt")
	}
	if err != nil {
		return false, err
	}
	if queue.totalSamples > queue.limits.samples-metadata.samples ||
		queue.totalBytes > queue.limits.bytes-metadata.bytes {
		return false, fmt.Errorf("%w while loading persisted intervals", ErrQueueCapacity)
	}
	queue.intervals = append(queue.intervals, metadata)
	queue.totalSamples += metadata.samples
	queue.totalBytes += metadata.bytes
	queue.nextPosition = max(queue.nextPosition, position+1)
	return false, nil
}

func removeEntry(path, kind string) error {
	if err := os.RemoveAll(path); err != nil {
		return fmt.Errorf("remove %s Edge usage interval %q: %w", kind, filepath.Base(path), err)
	}
	return nil
}

func (queue *intervalQueue) loadCursor() error {
	path := filepath.Join(queue.root, cursorFilename)
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read Edge usage cursor: %w", err)
	}
	var cursor queueCursor
	if err := decodeStrictJSON(payload, &cursor); err != nil {
		return fmt.Errorf("%w: decode Edge usage cursor: %w", errCorruptState, err)
	}
	if !cursor.valid() {
		return fmt.Errorf("%w: Edge usage cursor is invalid", errCorruptState)
	}
	queue.cursor = cursor
	return nil
}

func (queue *intervalQueue) resetCorruptState() error {
	entries, err := os.ReadDir(queue.root)
	if err != nil {
		return fmt.Errorf("read Edge usage queue: %w", err)
	}
	for _, entry := range entries {
		name := entry.Name()
		isInterval := strings.HasPrefix(name, intervalPrefix)
		if name != cursorFilename && !isInterval && !strings.HasPrefix(name, incompleteEntryPrefix) {
			continue
		}
		if err := os.RemoveAll(filepath.Join(queue.root, name)); err != nil {
			return fmt.Errorf("reset corrupt Edge usage state %q: %w", name, err)
		}
		if isInterval {
			queue.recovery.DiscardedIntervals++
		}
	}
	queue.cursor = queueCursor{}
	queue.recovery.CursorReset = true
	return atomicfile.SyncDirectory(queue.root)
}

func (cursor queueCursor) valid() bool {
	switch {
	case cursor.Epoch < 0:
		return false
	case cursor.Epoch == 0:
		return cursor.Sequence == 0 && cursor.Digest == "" && cursor.Position == 0
	case cursor.Sequence > 0:
		return isSHA256Digest(cursor.Digest) && cursor.Position > 0
	default:
		return cursor.Digest == "" || isSHA256Digest(cursor.Digest)
	}
}

func (queue *intervalQueue) readInterval(
	directory string,
) (*usageInterval, queuedInterval, error) {
	metadata := queuedInterval{directory: directory}
	position, err := parseIntervalDirectoryPosition(filepath.Base(directory))
	if err != nil {
		return nil, metadata, err
	}
	metadata.position = position
	entries, err := os.ReadDir(directory)
	if err != nil {
		return nil, metadata, fmt.Errorf("read Edge usage interval %q: %w", directory, err)
	}
	if len(entries) != 1 || entries[0].IsDir() || entries[0].Name() != intervalFilename {
		return nil, metadata, fmt.Errorf(
			"%w: Edge usage interval %q must contain only %s",
			errCorruptState,
			directory,
			intervalFilename,
		)
	}
	path := filepath.Join(directory, intervalFilename)
	info, err := os.Stat(path)
	if err != nil {
		return nil, metadata, fmt.Errorf("inspect Edge usage interval %q: %w", path, err)
	}
	if !info.Mode().IsRegular() || info.Size() <= 0 || info.Size() > queue.limits.checkpointBytes {
		return nil, metadata, fmt.Errorf("%w: Edge usage interval %q has invalid size or type", errCorruptState, path)
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		return nil, metadata, fmt.Errorf("read Edge usage interval %q: %w", path, err)
	}
	var interval usageInterval
	if err := decodeStrictJSON(payload, &interval); err != nil {
		return nil, metadata, fmt.Errorf("%w: decode Edge usage interval %q: %w", errCorruptState, path, err)
	}
	if len(interval.Samples) > queue.limits.checkpointSamples {
		return nil, metadata, fmt.Errorf("%w: Edge usage interval %q exceeds the sample limit", errCorruptState, path)
	}
	if err := interval.validate(); err != nil {
		return nil, metadata, fmt.Errorf("%w: validate Edge usage interval %q: %w", errCorruptState, path, err)
	}
	metadata.samples = len(interval.Samples)
	metadata.bytes = int64(len(payload))
	return &interval, metadata, nil
}

func parseIntervalDirectoryPosition(name string) (uint64, error) {
	value, found := strings.CutPrefix(name, intervalPrefix)
	if !found || len(value) != intervalPositionDigits {
		return 0, fmt.Errorf("unexpected entry %q in Edge usage queue", name)
	}
	position, err := strconv.ParseUint(value, 10, 64)
	if err != nil || position == 0 {
		return 0, fmt.Errorf("invalid Edge usage interval name %q", name)
	}
	return position, nil
}

func decodeStrictJSON(payload []byte, destination any) error {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("unexpected trailing JSON value")
		}
		return err
	}
	return nil
}
