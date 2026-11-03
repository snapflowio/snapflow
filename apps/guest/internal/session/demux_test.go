// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"bytes"
	"testing"
)

func collect(chunks []logChunk, stdout, stderr *bytes.Buffer) {
	for _, chunk := range chunks {
		if chunk.stream == streamStdout {
			stdout.Write(chunk.data)
		} else {
			stderr.Write(chunk.data)
		}
	}
}

func TestSplitSeparatesStreamsAndDropsUnmarkedPrefix(t *testing.T) {
	log := "noise" + stdoutMarker + "one\n" + stderrMarker + "two\n" + stdoutMarker + "three\n"
	stdout, stderr := Split([]byte(log))
	if string(stdout) != "one\nthree\n" || string(stderr) != "two\n" {
		t.Fatalf("Split() = %q, %q", stdout, stderr)
	}
}

func TestDemuxerKeepsMarkersSplitAcrossReads(t *testing.T) {
	log := []byte(stdoutMarker + "out\n" + stderrMarker + "err\n")
	for cut := 1; cut < len(log); cut++ {
		var demux demuxer
		var stdout, stderr bytes.Buffer
		collect(demux.feed(log[:cut]), &stdout, &stderr)
		collect(demux.feed(log[cut:]), &stdout, &stderr)
		collect(demux.flush(), &stdout, &stderr)
		if stdout.String() != "out\n" || stderr.String() != "err\n" {
			t.Fatalf("cut at %d: stdout = %q, stderr = %q", cut, stdout.String(), stderr.String())
		}
	}
}
