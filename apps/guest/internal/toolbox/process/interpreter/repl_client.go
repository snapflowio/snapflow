// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package interpreter

import (
	"errors"
	"os"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/wsstream"
)

func (c *Context) Info() ContextInfo {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.info
}

func (c *Context) enqueue(job execJob) {
	c.mu.Lock()
	queue, done := c.queue, c.done
	c.mu.Unlock()
	select {
	case queue <- job:
	case <-done:
		if err := wsstream.Close(job.ws, websocket.CloseGoingAway, "context is not active"); err != nil {
			c.logger.Debug("Failed to reject an interpreter job", "error", err)
		}
	}
}

func (c *Context) processQueue(queue <-chan execJob, done <-chan struct{}) {
	for {
		select {
		case job := <-queue:
			c.run(job)
		case <-done:
			c.rejectQueued(queue)
			return
		}
	}
}

func (c *Context) rejectQueued(queue <-chan execJob) {
	for {
		select {
		case job := <-queue:
			if err := wsstream.Close(job.ws, websocket.CloseGoingAway, "worker process ended"); err != nil {
				c.logger.Debug("Failed to reject a queued interpreter job", "error", err)
			}
		default:
			return
		}
	}
}

func (c *Context) run(job execJob) {
	c.attachWebSocket(job.ws)
	result, err := c.executeCode(job.code, job.envs, job.timeout)
	if common_errors.IsRequestTimeoutError(err) || result.Status == CommandStatusTimeout {
		c.closeClient(WebSocketCloseTimeout, "")
		return
	}
	c.closeClient(websocket.CloseNormalClosure, "")
}

func (c *Context) closeClient(code int, message string) {
	c.mu.Lock()
	client := c.client
	c.client = nil
	c.mu.Unlock()
	if client != nil {
		client.requestClose(code, message)
	}
}

func (c *Context) executeCode(code string, envs map[string]string, timeout time.Duration) (*CommandExecution, error) {
	execution := &CommandExecution{
		ID:        uuid.NewString(),
		Code:      code,
		Status:    CommandStatusRunning,
		StartedAt: time.Now(),
		finished:  make(chan struct{}),
	}
	c.setActiveCommand(execution)
	defer c.setActiveCommand(nil)

	if err := c.sendCommand(WorkerCommand{ID: execution.ID, Code: code, Envs: envs}); err != nil {
		c.finishActiveCommand(CommandStatusError, &Error{Name: "CommunicationError", Value: err.Error()})
		return execution, err
	}
	if awaitExecution(execution, timeout) {
		return execution, nil
	}
	c.signalWorker(syscall.SIGINT)
	if awaitExecution(execution, gracePeriod) {
		return execution, nil
	}
	c.signalWorker(syscall.SIGKILL)
	c.finishActiveCommand(CommandStatusTimeout, &Error{
		Name:  "TimeoutError",
		Value: "Execution timeout - code took too long to execute",
	})
	return execution, common_errors.NewRequestTimeoutError(errors.New("execution timeout"))
}

func awaitExecution(execution *CommandExecution, timeout time.Duration) bool {
	if timeout <= 0 {
		<-execution.finished
		return true
	}
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-execution.finished:
		return true
	case <-timer.C:
		return false
	}
}

func (c *Context) signalWorker(signal syscall.Signal) {
	c.mu.Lock()
	cmd := c.cmd
	c.mu.Unlock()
	if cmd == nil || cmd.Process == nil {
		return
	}
	if err := cmd.Process.Signal(signal); err != nil && !errors.Is(err, os.ErrProcessDone) {
		c.logger.Debug("failed to signal the interpreter worker", "signal", signal, "error", err)
	}
}

func (c *Context) setActiveCommand(execution *CommandExecution) {
	c.commandMu.Lock()
	defer c.commandMu.Unlock()
	c.activeCommand = execution
}

func (c *Context) finishActiveCommand(status string, failure *Error) {
	c.commandMu.Lock()
	defer c.commandMu.Unlock()
	execution := c.activeCommand
	if execution == nil || execution.completed {
		return
	}
	if execution.Status == CommandStatusRunning || status == CommandStatusTimeout {
		execution.Status = status
	}
	if failure != nil {
		execution.Error = failure
	}
	now := time.Now()
	execution.EndedAt = &now
	execution.completed = true
	close(execution.finished)
}

func (c *Context) recordActiveError(failure *Error) {
	c.commandMu.Lock()
	defer c.commandMu.Unlock()
	execution := c.activeCommand
	if execution == nil || execution.completed {
		return
	}
	execution.Status = CommandStatusError
	execution.Error = failure
}

func (c *Context) failActiveCommand(failure *Error) {
	c.finishActiveCommand(CommandStatusError, failure)
}
