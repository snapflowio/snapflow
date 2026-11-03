// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package cli

import (
	"errors"
	"fmt"
	"syscall"
)

const (
	ExitSuccess            = 0
	ExitRuntimeError       = 1
	ExitConfigurationError = 2
	ExitPermissionDenied   = 77
	signalExitBase         = 128
	ExitInterrupted        = signalExitBase + int(syscall.SIGINT)
	ExitTerminated         = signalExitBase + int(syscall.SIGTERM)
)

type ExitError struct {
	Code int
	Err  error
	Hint string
}

func (err *ExitError) Error() string {
	if err.Err != nil {
		return err.Err.Error()
	}
	return fmt.Sprintf("exited with status %d", err.Code)
}

func (err *ExitError) Unwrap() error {
	return err.Err
}

func ExitCode(err error) int {
	if err == nil {
		return ExitSuccess
	}
	var coded *ExitError
	if errors.As(err, &coded) {
		return coded.Code
	}
	return ExitConfigurationError
}

func ExitWith(code int) error {
	if code == ExitSuccess {
		return nil
	}
	return &ExitError{Code: code}
}

func Fail(code int, err error, hint string) error {
	return &ExitError{Code: code, Err: err, Hint: hint}
}

func Report(err error) (message, hint string, show bool) {
	var coded *ExitError
	if !errors.As(err, &coded) {
		return err.Error(), "", true
	}
	if coded.Err == nil {
		return "", "", false
	}
	return err.Error(), coded.Hint, true
}
