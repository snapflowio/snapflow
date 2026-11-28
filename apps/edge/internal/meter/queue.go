// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/google/uuid"
	"github.com/snapflowio/common-go/pkg/atomicfile"
	"github.com/snapflowio/edge/internal/statefile"
)

const (
	directoryName          = "usage-intervals"
	intervalPrefix         = "interval-"
	incompleteEntryPrefix  = "."
	pendingIntervalPrefix  = incompleteEntryPrefix + "pending-"
	intervalFilename       = "interval.json"
	cursorFilename         = "usage-cursor.json"
	intervalPositionDigits = 20

	maximumQueuedSamples     = 1_000_000
	maximumQueueBytes        = 512 << 20
	maximumCheckpointBytes   = 16 << 20
	intervalPositionNameForm = "%s%0*d"
)

var ErrQueueCapacity = errors.New("edge usage queue capacity exhausted")

type limits struct {
	samples           int
	bytes             int64
	checkpointSamples int
	checkpointBytes   int64
	reserveSamples    int
	reserveBytes      int64
}

func defaultLimits() limits {
	return limits{
		samples:           maximumQueuedSamples,
		bytes:             maximumQueueBytes,
		checkpointSamples: maximumCheckpointSamples,
		checkpointBytes:   maximumCheckpointBytes,
		reserveSamples:    maximumCheckpointSamples,
		reserveBytes:      maximumCheckpointBytes,
	}
}

type queueCursor struct {
	Epoch    int32  `json:"epoch"`
	Sequence uint64 `json:"sequence"`
	Digest   string `json:"digest,omitempty"`
	Position uint64 `json:"position,omitempty"`
}

type queuedInterval struct {
	directory string
	position  uint64
	samples   int
	bytes     int64
}

type intervalQueue struct {
	mu           sync.Mutex
	root         string
	limits       limits
	createTemp   func(string, string) (string, error)
	cursor       queueCursor
	recovery     queueRecovery
	intervals    []queuedInterval
	nextPosition uint64
	totalSamples int
	totalBytes   int64
}

type QueueSnapshot struct {
	Samples        int
	Bytes          int64
	SampleHeadroom int
	ByteHeadroom   int64
}

func openQueue(stateDirectory, edgeID string) (*intervalQueue, error) {
	return openQueueWithLimits(stateDirectory, edgeID, defaultLimits())
}

func openQueueWithLimits(
	stateDirectory string,
	edgeID string,
	queueLimits limits,
) (*intervalQueue, error) {
	if uuid.Validate(edgeID) != nil {
		return nil, errors.New("edge usage queue requires a valid Edge ID")
	}
	if err := queueLimits.validate(); err != nil {
		return nil, err
	}
	root := filepath.Join(stateDirectory, directoryName, edgeID)
	if err := statefile.EnsureDirectory(root); err != nil {
		return nil, fmt.Errorf("create Edge usage queue: %w", err)
	}
	queue := &intervalQueue{
		root:       root,
		limits:     queueLimits,
		createTemp: os.MkdirTemp,
	}
	if err := queue.load(); err != nil {
		return nil, err
	}
	return queue, nil
}

func (queueLimits limits) validate() error {
	if queueLimits.samples <= 0 || queueLimits.bytes <= 0 ||
		queueLimits.checkpointSamples <= 0 || queueLimits.checkpointBytes <= 0 ||
		queueLimits.reserveSamples <= 0 || queueLimits.reserveBytes <= 0 ||
		queueLimits.checkpointSamples > queueLimits.samples || queueLimits.checkpointBytes > queueLimits.bytes ||
		queueLimits.reserveSamples > queueLimits.samples || queueLimits.reserveBytes > queueLimits.bytes {
		return errors.New("edge usage queue limits are invalid")
	}
	return nil
}

func (queue *intervalQueue) enqueue(interval usageInterval) (resultErr error) {
	queue.mu.Lock()
	defer queue.mu.Unlock()
	if err := interval.validate(); err != nil {
		return err
	}
	payload, err := json.Marshal(interval)
	if err != nil {
		return fmt.Errorf("encode Edge usage interval: %w", err)
	}
	payloadBytes := int64(len(payload))
	if len(interval.Samples) > queue.limits.checkpointSamples ||
		payloadBytes > queue.limits.checkpointBytes ||
		queue.totalSamples > queue.limits.samples-len(interval.Samples) ||
		queue.totalBytes > queue.limits.bytes-payloadBytes {
		return ErrQueueCapacity
	}
	position := queue.nextPosition
	directoryPath := filepath.Join(queue.root, intervalDirectoryName(position))
	temporaryPath, err := queue.createTemp(queue.root, pendingIntervalPrefix)
	if err != nil {
		return fmt.Errorf("create Edge usage interval: %w", err)
	}
	installed := false
	defer func() {
		if installed {
			return
		}
		if removeErr := os.RemoveAll(temporaryPath); removeErr != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf(
				"remove incomplete Edge usage interval: %w",
				removeErr,
			))
		}
	}()
	if err := statefile.WriteFile(filepath.Join(temporaryPath, intervalFilename), payload); err != nil {
		return fmt.Errorf("persist Edge usage interval: %w", err)
	}
	if err := os.Rename(temporaryPath, directoryPath); err != nil {
		return fmt.Errorf("install Edge usage interval: %w", err)
	}
	temporaryPath = directoryPath
	if err := atomicfile.SyncDirectory(queue.root); err != nil {
		return err
	}
	installed = true
	queue.intervals = append(queue.intervals, queuedInterval{
		directory: directoryPath,
		position:  position,
		samples:   len(interval.Samples),
		bytes:     payloadBytes,
	})
	queue.nextPosition++
	queue.totalSamples += len(interval.Samples)
	queue.totalBytes += payloadBytes
	return nil
}

func (queue *intervalQueue) peek() (*usageInterval, queueCursor, error) {
	queue.mu.Lock()
	defer queue.mu.Unlock()
	if len(queue.intervals) == 0 {
		return nil, queue.cursor, nil
	}
	interval, metadata, err := queue.readInterval(queue.intervals[0].directory)
	if err != nil {
		return nil, queue.cursor, err
	}
	if metadata != queue.intervals[0] {
		return nil, queue.cursor, errors.New("edge usage interval changed after it was loaded")
	}
	return interval, queue.cursor, nil
}

func (queue *intervalQueue) beginEpoch(epoch int32, anchorDigest string) error {
	queue.mu.Lock()
	defer queue.mu.Unlock()
	if epoch < 1 || anchorDigest != "" && !isSHA256Digest(anchorDigest) {
		return errors.New("edge usage epoch is invalid")
	}
	return queue.persistCursorLocked(queueCursor{
		Epoch:    epoch,
		Digest:   anchorDigest,
		Position: queue.cursor.Position,
	})
}

func (queue *intervalQueue) acknowledge(epoch int32, sequence uint64, digest string) error {
	queue.mu.Lock()
	defer queue.mu.Unlock()
	if len(queue.intervals) == 0 {
		return errors.New("edge usage acknowledgement has no pending interval")
	}
	if epoch != queue.cursor.Epoch || sequence != queue.cursor.Sequence+1 || !isSHA256Digest(digest) {
		return errors.New("edge usage acknowledgement does not extend the acknowledged chain")
	}
	nextCursor := queueCursor{Epoch: epoch, Sequence: sequence, Digest: digest, Position: queue.intervals[0].position}
	if err := queue.persistCursorLocked(nextCursor); err != nil {
		return err
	}
	return queue.removeHeadLocked()
}

func (queue *intervalQueue) persistCursorLocked(cursor queueCursor) error {
	if err := statefile.WriteJSON(filepath.Join(queue.root, cursorFilename), cursor); err != nil {
		return fmt.Errorf("persist Edge usage cursor: %w", err)
	}
	queue.cursor = cursor
	return nil
}

func (queue *intervalQueue) discardHead() error {
	queue.mu.Lock()
	defer queue.mu.Unlock()
	if len(queue.intervals) == 0 {
		return errors.New("edge usage queue has no interval to discard")
	}
	return queue.removeHeadLocked()
}

func (queue *intervalQueue) removeHeadLocked() error {
	head := queue.intervals[0]
	if err := os.RemoveAll(head.directory); err != nil {
		return fmt.Errorf("remove Edge usage interval: %w", err)
	}
	if err := atomicfile.SyncDirectory(queue.root); err != nil {
		return err
	}
	queue.intervals = queue.intervals[1:]
	queue.totalSamples -= head.samples
	queue.totalBytes -= head.bytes
	return nil
}

func (queue *intervalQueue) hasIntervalCapacity() bool {
	queue.mu.Lock()
	defer queue.mu.Unlock()
	return queue.totalSamples <= queue.limits.samples-queue.limits.reserveSamples &&
		queue.totalBytes <= queue.limits.bytes-queue.limits.reserveBytes
}

func (queue *intervalQueue) snapshot() QueueSnapshot {
	queue.mu.Lock()
	defer queue.mu.Unlock()
	return QueueSnapshot{
		Samples:        queue.totalSamples,
		Bytes:          queue.totalBytes,
		SampleHeadroom: max(0, queue.limits.samples-queue.totalSamples),
		ByteHeadroom:   max(0, queue.limits.bytes-queue.totalBytes),
	}
}

func intervalDirectoryName(position uint64) string {
	return fmt.Sprintf(intervalPositionNameForm, intervalPrefix, intervalPositionDigits, position)
}
