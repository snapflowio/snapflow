// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"bytes"
)

type logStream int

const (
	streamNone logStream = iota
	streamStdout
	streamStderr
)

const (
	stdoutMarker = "\x01\x01\x01"
	stderrMarker = "\x02\x02\x02"
	markerLength = len(stdoutMarker)
)

type logChunk struct {
	stream logStream
	data   []byte
}

type demuxer struct {
	stream  logStream
	pending []byte
}

func (d *demuxer) feed(data []byte) []logChunk {
	var chunks []logChunk
	d.pending = append(d.pending, data...)
	for {
		index, next := nextMarker(d.pending)
		if index < 0 {
			break
		}
		chunks = d.take(chunks, index)
		d.stream = next
		d.pending = d.pending[markerLength:]
	}
	held := min(len(d.pending), markerLength-1)
	return d.take(chunks, len(d.pending)-held)
}

func (d *demuxer) flush() []logChunk {
	return d.take(nil, len(d.pending))
}

func (d *demuxer) take(chunks []logChunk, length int) []logChunk {
	payload := d.pending[:length]
	d.pending = d.pending[length:]
	if d.stream == streamNone || len(payload) == 0 {
		return chunks
	}
	return append(chunks, logChunk{stream: d.stream, data: payload})
}

func nextMarker(data []byte) (int, logStream) {
	stdout := bytes.Index(data, []byte(stdoutMarker))
	stderr := bytes.Index(data, []byte(stderrMarker))
	switch {
	case stdout < 0 && stderr < 0:
		return -1, streamNone
	case stderr < 0 || (stdout >= 0 && stdout < stderr):
		return stdout, streamStdout
	default:
		return stderr, streamStderr
	}
}

func Split(data []byte) (stdout, stderr []byte) {
	var demux demuxer
	for _, chunk := range append(demux.feed(data), demux.flush()...) {
		if chunk.stream == streamStdout {
			stdout = append(stdout, chunk.data...)
		} else {
			stderr = append(stderr, chunk.data...)
		}
	}
	return stdout, stderr
}
