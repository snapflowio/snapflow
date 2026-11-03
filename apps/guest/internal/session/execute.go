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
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	common_errors "github.com/snapflowio/common-go/pkg/errors"
	"github.com/snapflowio/guest/internal/util"
)

const (
	exitPollInterval = 50 * time.Millisecond
	scriptFileMode   = 0o600
	cancelledExit    = 1
	pendingSuffix    = ".pending"
	syncInputHolder  = `cat /dev/null > "$ip" &`
	asyncInputHolder = `while :; do sleep 3600; done > "$ip" &`
)

const wrapperFormat = `
{
	log=%s
	dir=%s
	sp="$dir/stdout.pipe"
	ep="$dir/stderr.pipe"
	ip=%s

	rm -f "$sp" "$ep" "$ip" && mkfifo "$sp" "$ep" "$ip" || exit 1

	cleanup() { rm -f "$sp" "$ep" "$ip"; }
	trap 'cleanup' EXIT HUP INT TERM

	( while IFS= read -r line || [ -n "$line" ]; do printf '%s%%s\n' "$line"; done < "$sp" ) >> "$log" & r1=$!
	( while IFS= read -r line || [ -n "$line" ]; do printf '%s%%s\n' "$line"; done < "$ep" ) >> "$log" & r2=$!

	%s
	ip_pid=$!

	{ . %s; } < "$ip" > "$sp" 2> "$ep"
	_ec=$?

	kill "$ip_pid" 2>/dev/null; wait "$ip_pid" 2>/dev/null

	wait "$r1" "$r2"

	echo "$_ec" > %s && mv %s %s

	cleanup
}
`

func (s *Service) Execute(ctx context.Context, sessionID, commandID, script string, async, suppressInputEcho bool) (*Execution, error) {
	found, err := s.lookup(sessionID)
	if err != nil {
		return nil, err
	}
	if commandID == "" {
		commandID = uuid.NewString()
	}
	if err := ValidateID(commandID); err != nil {
		return nil, err
	}
	dir, err := s.directory(sessionID, commandID)
	if err != nil {
		return nil, err
	}
	created := &command{id: commandID, text: script, suppressInputEcho: suppressInputEcho, dir: dir}
	if !found.commands.SetIfAbsent(commandID, created) {
		return nil, common_errors.NewConflictError(errors.New("command with the given ID already exists"))
	}
	if err := prepareCommand(created); err != nil {
		return nil, common_errors.NewBadRequestError(err)
	}
	if err := found.write(wrapCommand(created, async)); err != nil {
		return nil, common_errors.NewBadRequestError(fmt.Errorf("write command: %w", err))
	}
	if async {
		return &Execution{CommandID: commandID}, nil
	}
	return s.awaitExecution(ctx, found, created)
}

func prepareCommand(created *command) error {
	if err := os.MkdirAll(created.dir, directoryMode); err != nil {
		return fmt.Errorf("create command directory: %w", err)
	}
	logFile, err := os.Create(created.outputPath())
	if err != nil {
		return fmt.Errorf("create command log: %w", err)
	}
	if err := logFile.Close(); err != nil {
		return fmt.Errorf("close command log: %w", err)
	}
	if err := os.WriteFile(created.scriptPath(), []byte(created.text), scriptFileMode); err != nil {
		return fmt.Errorf("write command script: %w", err)
	}
	return nil
}

func wrapCommand(created *command, async bool) string {
	inputHolder := syncInputHolder
	if async {
		inputHolder = asyncInputHolder
	}
	exitCodePath := created.exitCodePath()
	pendingExitCodePath := exitCodePath + pendingSuffix
	return fmt.Sprintf(
		wrapperFormat,
		util.ShellQuote(created.outputPath()),
		util.ShellQuote(created.dir),
		util.ShellQuote(created.inputPath()),
		octalEscapes(stdoutMarker),
		octalEscapes(stderrMarker),
		inputHolder,
		util.ShellQuote(created.scriptPath()),
		util.ShellQuote(pendingExitCodePath),
		util.ShellQuote(pendingExitCodePath),
		util.ShellQuote(exitCodePath),
	)
}

func (s *Service) awaitExecution(ctx context.Context, found *session, created *command) (*Execution, error) {
	ticker := time.NewTicker(exitPollInterval)
	defer ticker.Stop()
	for {
		exitCode, exited, err := readExitCode(created.exitCodePath())
		if err != nil {
			return nil, common_errors.NewBadRequestError(err)
		}
		if exited {
			created.recordExitCode(exitCode)
			return collectExecution(created, exitCode)
		}
		select {
		case <-found.ended:
			created.recordExitCode(cancelledExit)
			return nil, common_errors.NewBadRequestError(errors.New("session cancelled"))
		case <-ctx.Done():
			return nil, common_errors.NewRequestTimeoutError(fmt.Errorf("wait for command %s: %w", created.id, ctx.Err()))
		case <-ticker.C:
		}
	}
}

func collectExecution(created *command, exitCode int) (*Execution, error) {
	output, err := os.ReadFile(created.outputPath())
	if err != nil {
		return nil, common_errors.NewBadRequestError(fmt.Errorf("read command log: %w", err))
	}
	stdout, stderr := Split(output)
	return &Execution{
		CommandID: created.id,
		Output:    string(output),
		Stdout:    string(stdout),
		Stderr:    string(stderr),
		ExitCode:  exitCode,
	}, nil
}

func readExitCode(path string) (int, bool, error) {
	content, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, fmt.Errorf("read exit code: %w", err)
	}
	trimmed := strings.TrimSpace(string(content))
	if trimmed == "" {
		return 0, false, nil
	}
	exitCode, err := strconv.Atoi(trimmed)
	if err != nil {
		return 0, false, fmt.Errorf("parse exit code %q: %w", trimmed, err)
	}
	return exitCode, true, nil
}

func octalEscapes(marker string) string {
	var escaped strings.Builder
	for _, character := range []byte(marker) {
		fmt.Fprintf(&escaped, `\%03o`, character)
	}
	return escaped.String()
}
