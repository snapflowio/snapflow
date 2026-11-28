// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/initrd"
)

const (
	maximumInitBytes = 128 * 1024 * 1024
	initrdMode       = 0o444
	usageExitCode    = 2
)

func main() {
	flags := flag.NewFlagSet("build-initrd", flag.ContinueOnError)
	initPath := flags.String("init", "", "guest init executable")
	outputPath := flags.String("output", "", "initrd output path")
	if err := flags.Parse(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "build-initrd: %v\n", err)
		os.Exit(usageExitCode)
	}
	if err := build(*initPath, *outputPath); err != nil {
		fmt.Fprintf(os.Stderr, "build-initrd: %v\n", err)
		os.Exit(1)
	}
}

func build(initPath, outputPath string) error {
	initPath = filepath.Clean(strings.TrimSpace(initPath))
	outputPath = filepath.Clean(strings.TrimSpace(outputPath))
	if initPath == "." || outputPath == "." {
		return errors.New("--init and --output are required")
	}
	contents, err := readGuestInit(initPath)
	if err != nil {
		return err
	}
	var archive bytes.Buffer
	if err := initrd.WriteArchive(&archive, contents); err != nil {
		return err
	}
	if err := atomicfile.Replace(outputPath, archive.Bytes(), initrdMode); err != nil {
		return fmt.Errorf("publish initrd: %w", err)
	}
	return atomicfile.Commit(outputPath)
}

func readGuestInit(initPath string) ([]byte, error) {
	guestInit, err := os.Open(initPath)
	if err != nil {
		return nil, fmt.Errorf("open guest init: %w", err)
	}
	contents, readErr := io.ReadAll(io.LimitReader(guestInit, maximumInitBytes+1))
	closeErr := guestInit.Close()
	if err := errors.Join(readErr, closeErr); err != nil {
		return nil, fmt.Errorf("read guest init: %w", err)
	}
	if len(contents) == 0 || len(contents) > maximumInitBytes {
		return nil, errors.New("guest init has an invalid size")
	}
	return contents, nil
}
