// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package meter

import (
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"

	"github.com/snapflowio/edge/internal/statefile"
)

func TestDurableUsageQueueSurvivesRestartAndAcknowledgement(t *testing.T) {
	stateDirectory := t.TempDir()
	signer := newTestSigner(t)
	start := testIntervalStart()
	queue := openTestQueue(t, stateDirectory)
	if err := queue.enqueue(testInterval(start)); err != nil {
		t.Fatalf("enqueue interval: %v", err)
	}

	reopened := openTestQueue(t, stateDirectory)
	if err := reopened.beginEpoch(1, ""); err != nil {
		t.Fatalf("begin usage epoch: %v", err)
	}
	pending, cursor, err := reopened.peek()
	if err != nil {
		t.Fatalf("read persisted interval: %v", err)
	}
	if pending == nil || !pending.IntervalStartedAt.Equal(start) {
		t.Fatal("persisted interval changed after restart")
	}
	signed, err := signCheckpoint(signer, cursor, *pending)
	if err != nil {
		t.Fatalf("sign interval: %v", err)
	}
	if signed.Sequence != "1" || signed.PreviousDigest != nil {
		t.Fatalf("first checkpoint chain = %s/%v", signed.Sequence, signed.PreviousDigest)
	}
	if err := reopened.acknowledge(1, 1, signed.Digest); err != nil {
		t.Fatalf("acknowledge checkpoint: %v", err)
	}

	afterAcknowledgement := openTestQueue(t, stateDirectory)
	pending, cursor, err = afterAcknowledgement.peek()
	if err != nil {
		t.Fatalf("read acknowledged queue: %v", err)
	}
	if pending != nil {
		t.Fatal("acknowledged interval was replayed after restart")
	}
	if cursor.Epoch != 1 || cursor.Sequence != 1 || cursor.Digest != signed.Digest {
		t.Fatalf("unexpected durable cursor: %+v", cursor)
	}
}

func TestDurableUsageQueueDiscardKeepsChainPosition(t *testing.T) {
	signer := newTestSigner(t)
	start := testIntervalStart()
	queue := openTestQueue(t, t.TempDir())
	if err := queue.beginEpoch(1, ""); err != nil {
		t.Fatalf("begin usage epoch: %v", err)
	}
	for _, startedAt := range []time.Time{start, start.Add(time.Minute)} {
		if err := queue.enqueue(testInterval(startedAt)); err != nil {
			t.Fatalf("enqueue interval: %v", err)
		}
	}
	if err := queue.discardHead(); err != nil {
		t.Fatalf("discard head: %v", err)
	}
	next, cursor, err := queue.peek()
	if err != nil || next == nil {
		t.Fatalf("read next interval: %v", err)
	}
	signed, err := signCheckpoint(signer, cursor, *next)
	if err != nil {
		t.Fatalf("sign interval: %v", err)
	}
	if signed.Sequence != "1" || !next.IntervalStartedAt.Equal(start.Add(time.Minute)) {
		t.Fatalf("interval after discard took sequence %s", signed.Sequence)
	}
}

func TestDurableUsageQueueNewEpochRestartsTheSequenceFromTheAnchor(t *testing.T) {
	stateDirectory := t.TempDir()
	queue := openTestQueue(t, stateDirectory)
	if err := queue.enqueue(testInterval(testIntervalStart())); err != nil {
		t.Fatalf("enqueue interval: %v", err)
	}
	if err := queue.beginEpoch(1, ""); err != nil {
		t.Fatalf("begin first epoch: %v", err)
	}
	if err := queue.acknowledge(1, 1, testDigest()); err != nil {
		t.Fatalf("acknowledge checkpoint: %v", err)
	}
	if err := queue.beginEpoch(2, testDigest()); err != nil {
		t.Fatalf("begin second epoch: %v", err)
	}
	reopened := openTestQueue(t, stateDirectory)
	if err := reopened.enqueue(testInterval(testIntervalStart().Add(time.Minute))); err != nil {
		t.Fatalf("enqueue interval after restart: %v", err)
	}
	next, cursor, err := reopened.peek()
	if err != nil || next == nil {
		t.Fatalf("read next interval: %v", err)
	}
	signed, err := signCheckpoint(newTestSigner(t), cursor, *next)
	if err != nil {
		t.Fatalf("sign interval: %v", err)
	}
	if signed.UsageEpoch != 2 || signed.Sequence != "1" || signed.PreviousDigest == nil ||
		*signed.PreviousDigest != testDigest() {
		t.Fatalf("checkpoint = %+v, want epoch 2 sequence 1 chained to the anchor", signed)
	}
}

func TestDurableUsageQueueTreatsAnInvalidCursorLikeWipedState(t *testing.T) {
	for _, cursor := range []any{
		queueCursor{Sequence: 1, Digest: testDigest(), Position: 1},
		queueCursor{Epoch: -1},
		queueCursor{Epoch: 1, Sequence: 1, Position: 1},
		queueCursor{Epoch: 1, Digest: "x"},
		map[string]any{"sequence": 1, "unknown": true},
	} {
		stateDirectory := t.TempDir()
		queue, err := openQueue(stateDirectory, testEdgeID)
		if err != nil {
			t.Fatalf("open queue: %v", err)
		}
		if err := queue.enqueue(testInterval(testIntervalStart())); err != nil {
			t.Fatalf("enqueue interval: %v", err)
		}
		writeCorruptInterval(t, queue.root, queue.nextPosition)
		if err := statefile.WriteJSON(filepath.Join(queue.root, cursorFilename), cursor); err != nil {
			t.Fatalf("persist cursor: %v", err)
		}
		recovered, err := openQueue(stateDirectory, testEdgeID)
		if err != nil {
			t.Fatalf("cursor %+v: reopen queue: %v", cursor, err)
		}
		if !recovered.recovery.CursorReset || recovered.recovery.DiscardedIntervals != 2 ||
			recovered.cursor != (queueCursor{}) || recovered.snapshot().Samples != 0 {
			t.Fatalf("cursor %+v: recovered queue = %+v / %+v, want empty state like a wipe", cursor, recovered.recovery, recovered.cursor)
		}
		if err := recovered.enqueue(testInterval(testIntervalStart())); err != nil {
			t.Fatalf("cursor %+v: enqueue after recovery: %v", cursor, err)
		}
	}
}

func TestDurableUsageQueueDiscardsOnlyCorruptIntervals(t *testing.T) {
	stateDirectory := t.TempDir()
	queue := openTestQueue(t, stateDirectory)
	if err := queue.beginEpoch(1, ""); err != nil {
		t.Fatalf("begin epoch: %v", err)
	}
	writeCorruptInterval(t, queue.root, queue.nextPosition)
	queue.nextPosition++
	if err := queue.enqueue(testInterval(testIntervalStart())); err != nil {
		t.Fatalf("enqueue interval: %v", err)
	}
	recovered := openTestQueue(t, stateDirectory)
	if recovered.recovery.CursorReset || recovered.recovery.DiscardedIntervals != 1 ||
		recovered.cursor.Epoch != 1 || recovered.snapshot().Samples != 1 {
		t.Fatalf("recovered queue = %+v / %+v, want the valid interval and cursor kept", recovered.recovery, recovered.cursor)
	}
}

const (
	corruptDirectoryMode = 0o700
	corruptFileMode      = 0o600
)

func writeCorruptInterval(t *testing.T, root string, position uint64) {
	t.Helper()
	directory := filepath.Join(root, intervalDirectoryName(position))
	if err := os.Mkdir(directory, corruptDirectoryMode); err != nil {
		t.Fatalf("create corrupt interval: %v", err)
	}
	if err := os.WriteFile(filepath.Join(directory, intervalFilename), []byte("{"), corruptFileMode); err != nil {
		t.Fatalf("write corrupt interval: %v", err)
	}
}

func TestDurableUsageQueueDropsIntervalAcknowledgedBeforeCrash(t *testing.T) {
	stateDirectory := t.TempDir()
	queue := openTestQueue(t, stateDirectory)
	if err := queue.enqueue(testInterval(testIntervalStart())); err != nil {
		t.Fatalf("enqueue interval: %v", err)
	}
	cursor := queueCursor{Epoch: 1, Sequence: 1, Digest: testDigest(), Position: queue.intervals[0].position}
	if err := statefile.WriteJSON(filepath.Join(queue.root, cursorFilename), cursor); err != nil {
		t.Fatalf("persist cursor: %v", err)
	}
	reopened := openTestQueue(t, stateDirectory)
	if pending, _, err := reopened.peek(); err != nil || pending != nil {
		t.Fatalf("acknowledged interval was replayed: %v", err)
	}
}

func TestDurableUsageQueueRemovesWritesInterruptedByACrash(t *testing.T) {
	stateDirectory := t.TempDir()
	queue := openTestQueue(t, stateDirectory)
	leftover := filepath.Join(queue.root, "."+cursorFilename+".interrupted.tmp")
	if err := os.WriteFile(leftover, []byte("{"), 0o600); err != nil {
		t.Fatalf("write interrupted cursor: %v", err)
	}
	if _, err := openQueue(stateDirectory, testEdgeID); err != nil {
		t.Fatalf("reopen queue after an interrupted write: %v", err)
	}
	if _, err := os.Stat(leftover); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("interrupted write was kept: %v", err)
	}
}

func TestDurableUsageQueueEnforcesCapacityBeforeLoss(t *testing.T) {
	bounded := limits{
		samples:           1,
		bytes:             1 << 20,
		checkpointSamples: 1,
		checkpointBytes:   1 << 20,
		reserveSamples:    1,
		reserveBytes:      1,
	}
	start := testIntervalStart()
	queue, err := openQueueWithLimits(t.TempDir(), testEdgeID, bounded)
	if err != nil {
		t.Fatalf("open bounded queue: %v", err)
	}
	if err := queue.enqueue(testInterval(start)); err != nil {
		t.Fatalf("enqueue first interval: %v", err)
	}
	if queue.hasIntervalCapacity() {
		t.Fatal("queue retained admission capacity after consuming its evidence reserve")
	}
	if err := queue.enqueue(testInterval(start.Add(time.Minute))); !errors.Is(err, ErrQueueCapacity) {
		t.Fatalf("expected capacity error, got %v", err)
	}
}

func TestDurableUsageQueueFailsClosedWhenDiskIsFull(t *testing.T) {
	queue := openTestQueue(t, t.TempDir())
	createTemp := queue.createTemp
	queue.createTemp = func(root, pattern string) (string, error) {
		return "", &os.PathError{Op: "mkdir", Path: filepath.Join(root, pattern), Err: syscall.ENOSPC}
	}
	if err := queue.enqueue(testInterval(testIntervalStart())); !errors.Is(err, syscall.ENOSPC) {
		t.Fatalf("disk-full enqueue error = %v, want ENOSPC", err)
	}
	if snapshot := queue.snapshot(); snapshot.Samples != 0 || snapshot.Bytes != 0 {
		t.Fatalf("failed disk write changed queue accounting: %+v", snapshot)
	}
	queue.createTemp = createTemp
	if err := queue.enqueue(testInterval(testIntervalStart())); err != nil {
		t.Fatalf("enqueue after storage recovery: %v", err)
	}
}

func openTestQueue(t *testing.T, stateDirectory string) *intervalQueue {
	t.Helper()
	opened, err := openQueue(stateDirectory, testEdgeID)
	if err != nil {
		t.Fatalf("open queue: %v", err)
	}
	return opened
}
