// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package session

import (
	"context"
	"errors"
	"io"
	"os/exec"
	"path/filepath"
	"sync"

	cmap "github.com/orcaman/concurrent-map/v2"
)

const (
	outputFileName   = "output.log"
	exitCodeFileName = "exit_code"
	inputPipeName    = "input.pipe"
	commandFileName  = "cmd.sh"
)

var errSessionStarting = errors.New("the session shell is still starting")

type session struct {
	id       string
	dir      string
	commands cmap.ConcurrentMap[string, *command]
	ended    <-chan struct{}
	cancel   context.CancelFunc
	mu       sync.Mutex
	shell    *exec.Cmd
	stdin    io.Writer
}

func (s *session) attach(shell *exec.Cmd, stdin io.Writer) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.shell = shell
	s.stdin = stdin
}

func (s *session) process() *exec.Cmd {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.shell
}

func (s *session) write(script string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.stdin == nil {
		return errSessionStarting
	}
	_, err := io.WriteString(s.stdin, script)
	return err
}

type command struct {
	id                string
	text              string
	suppressInputEcho bool
	dir               string
	mu                sync.Mutex
	exitCode          *int
}

func (c *command) outputPath() string {
	return filepath.Join(c.dir, outputFileName)
}

func (c *command) exitCodePath() string {
	return filepath.Join(c.dir, exitCodeFileName)
}

func (c *command) inputPath() string {
	return filepath.Join(c.dir, inputPipeName)
}

func (c *command) scriptPath() string {
	return filepath.Join(c.dir, commandFileName)
}

func (c *command) recordedExitCode() *int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.exitCode
}

func (c *command) recordExitCode(code int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.exitCode = &code
}

type Command struct {
	ID       string
	Command  string
	ExitCode *int
}

type Session struct {
	ID       string
	Commands []Command
}

type Execution struct {
	CommandID string
	Output    string
	Stdout    string
	Stderr    string
	ExitCode  int
}
