// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package interpreter

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

const workerScriptName = "snapflow_repl_worker.py"

//go:embed repl_worker.py
var pythonWorkerScript string

func pythonCandidates() []string {
	return []string{"python3", "python"}
}

func (c *Context) start(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.info.Active {
		return nil
	}
	workerPath, err := ensureWorkerScript()
	if err != nil {
		return err
	}
	processContext, cancel := context.WithCancel(context.WithoutCancel(ctx))
	cmd := exec.CommandContext(processContext, detectPythonCommand(), workerPath)
	cmd.Dir = c.info.Cwd
	cmd.Env = os.Environ()
	cmd.Stderr = os.Stderr
	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	if err := cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("failed to start Python worker: %w", err)
	}
	c.cmd = cmd
	c.stdin = stdin
	c.stdout = stdout
	c.cancel = cancel
	c.done = make(chan struct{})
	c.queue = make(chan execJob, jobQueueCapacity)
	c.info.Active = true
	c.logger.Debug("Started interpreter context", "contextId", c.info.ID, "pid", cmd.Process.Pid)

	go c.workerReadLoop(stdout)
	go c.processQueue(c.queue, c.done)
	go c.monitorProcess(cmd, c.done)
	return nil
}

func ensureWorkerScript() (string, error) {
	workerPath := filepath.Join(os.TempDir(), workerScriptName)
	_, err := os.Stat(workerPath)
	if err == nil {
		return workerPath, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("inspect worker script: %w", err)
	}
	if err := os.WriteFile(workerPath, []byte(pythonWorkerScript), workerScriptPerms); err != nil {
		return "", fmt.Errorf("failed to create worker script: %w", err)
	}
	return workerPath, nil
}

func detectPythonCommand() string {
	candidates := pythonCandidates()
	for _, candidate := range candidates {
		if _, err := exec.LookPath(candidate); err == nil {
			return candidate
		}
	}
	return candidates[0]
}

func (c *Context) monitorProcess(cmd *exec.Cmd, done chan struct{}) {
	exitCode, err := c.reaper.Reap(cmd)

	c.mu.Lock()
	c.info.Active = false
	contextID := c.info.ID
	c.mu.Unlock()
	close(done)

	if err != nil {
		c.failActiveCommand(&Error{Name: "WorkerProcessError", Value: err.Error()})
		c.logger.Error("Interpreter context process exited with error", "contextId", contextID, "error", err)
	} else {
		c.logger.Debug("Interpreter context process exited normally", "contextId", contextID, "exitCode", exitCode)
	}
	c.closeClient(websocket.CloseGoingAway, "worker process ended")
}

func (c *Context) shutdown() {
	c.mu.Lock()
	if !c.info.Active {
		c.mu.Unlock()
		return
	}
	contextID, cmd, done, cancel := c.info.ID, c.cmd, c.done, c.cancel
	c.mu.Unlock()

	if err := cmd.Process.Signal(syscall.SIGTERM); err != nil && !errors.Is(err, os.ErrProcessDone) {
		c.logger.Debug("failed to terminate interpreter context", "contextId", contextID, "error", err)
	}
	select {
	case <-done:
		c.logger.Debug("Interpreter context shut down gracefully", "contextId", contextID)
	case <-time.After(gracePeriod):
		c.logger.Debug("Interpreter context shutdown timeout, force killing", "contextId", contextID)
		cancel()
		<-done
	}
	c.closeClient(websocket.CloseGoingAway, "context shutdown")
}
