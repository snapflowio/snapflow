// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package common

import (
	"bytes"
	"sync"
)

type capturedOutput struct {
	mu       sync.Mutex
	combined bytes.Buffer
	stdout   bytes.Buffer
	stderr   bytes.Buffer
}

type streamWriter struct {
	output *capturedOutput
	stream *bytes.Buffer
}

func (o *capturedOutput) writer(stream *bytes.Buffer) streamWriter {
	return streamWriter{output: o, stream: stream}
}

func (w streamWriter) Write(data []byte) (int, error) {
	w.output.mu.Lock()
	defer w.output.mu.Unlock()
	if _, err := w.stream.Write(data); err != nil {
		return 0, err
	}
	return w.output.combined.Write(data)
}
