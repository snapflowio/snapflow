// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package interpreter

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

const (
	initialLineBuffer = 64 << 10
	maximumLineLength = 1 << 20
)

func (c *Context) sendCommand(cmd WorkerCommand) error {
	c.mu.Lock()
	stdin := c.stdin
	c.mu.Unlock()

	if stdin == nil {
		return errors.New("worker stdin not available")
	}

	data, err := json.Marshal(cmd)
	if err != nil {
		return fmt.Errorf("failed to marshal command: %w", err)
	}

	data = append(data, '\n')
	written, err := stdin.Write(data)
	if err != nil {
		return fmt.Errorf("failed to write command: %w", err)
	}
	if written != len(data) {
		return io.ErrShortWrite
	}

	return nil
}

func (c *Context) workerReadLoop(stdout io.Reader) {
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, initialLineBuffer), maximumLineLength)

	for scanner.Scan() {
		var chunk OutputMessage
		if err := json.Unmarshal(scanner.Bytes(), &chunk); err != nil {
			c.logger.Error("Failed to parse worker chunk", "error", err)
			continue
		}
		c.handleChunk(&chunk)
	}

	err := scanner.Err()
	if err != nil {
		c.logger.Error("Error reading from worker", "error", err)
	}
}

func (c *Context) handleChunk(chunk *OutputMessage) {
	c.emitOutput(chunk)
	switch {
	case chunk.Type == ChunkTypeError:
		c.recordActiveError(&Error{Name: chunk.Name, Value: chunk.Value, Traceback: chunk.Traceback})
	case chunk.Type == ChunkTypeControl && chunk.Text == ControlChunkTypeCompleted:
		c.finishActiveCommand(CommandStatusOK, nil)
	case chunk.Type == ChunkTypeControl && chunk.Text == ControlChunkTypeInterrupted:
		c.finishActiveCommand(CommandStatusTimeout, nil)
	}
}
