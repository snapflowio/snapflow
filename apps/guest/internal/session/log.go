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
	"io"
	"os"
	"time"

	common_errors "github.com/snapflowio/common-go/pkg/errors"
)

const (
	tailPollInterval = 20 * time.Millisecond
	tailChunkSize    = 32 << 10
)

func (s *Service) CommandLog(sessionID, commandID string) ([]byte, error) {
	_, target, err := s.lookupCommand(sessionID, commandID)
	if err != nil {
		return nil, err
	}
	output, err := os.ReadFile(target.outputPath())
	if err != nil {
		return nil, logFileError(err)
	}
	return output, nil
}

type LogStream struct {
	file         *os.File
	exitCodePath string
	sessionEnded <-chan struct{}
}

func (s *Service) OpenCommandLog(sessionID, commandID string) (*LogStream, error) {
	found, target, err := s.lookupCommand(sessionID, commandID)
	if err != nil {
		return nil, err
	}
	logFile, err := os.Open(target.outputPath())
	if err != nil {
		return nil, logFileError(err)
	}
	return &LogStream{file: logFile, exitCodePath: target.exitCodePath(), sessionEnded: found.ended}, nil
}

func (l *LogStream) Follow(ctx context.Context, follow bool, emit func([]byte) error) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go func() {
		select {
		case <-l.sessionEnded:
			cancel()
		case <-ctx.Done():
		}
	}()
	tailErr := tail(ctx, l.file, follow, l.exitCodePath, emit)
	return errors.Join(tailErr, l.Close())
}

func (l *LogStream) Close() error {
	return l.file.Close()
}

func tail(ctx context.Context, reader io.Reader, follow bool, exitCodePath string, emit func([]byte) error) error {
	buffer := make([]byte, tailChunkSize)
	ticker := time.NewTicker(tailPollInterval)
	defer ticker.Stop()
	exited := false
	for {
		if err := drain(reader, buffer, emit); err != nil || !follow || exited {
			return err
		}
		var err error
		exited, err = commandExited(exitCodePath)
		switch {
		case err != nil:
			return err
		case exited:
			continue
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

func drain(reader io.Reader, buffer []byte, emit func([]byte) error) error {
	for {
		read, err := reader.Read(buffer)
		if read > 0 {
			if emitErr := emit(buffer[:read]); emitErr != nil {
				return emitErr
			}
		}
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read command log: %w", err)
		}
	}
}

func commandExited(exitCodePath string) (bool, error) {
	if exitCodePath == "" {
		return false, nil
	}
	_, exited, err := readExitCode(exitCodePath)
	return exited, err
}

func logFileError(err error) error {
	switch {
	case errors.Is(err, os.ErrNotExist):
		return common_errors.NewNotFoundError(err)
	case errors.Is(err, os.ErrPermission):
		return common_errors.NewForbiddenError(err)
	default:
		return common_errors.NewInternalServerError(err)
	}
}
