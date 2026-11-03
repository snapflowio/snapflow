// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

//go:build linux

package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"

	"github.com/snapflowio/snapflow/internal/jobs/benchmark/suite"
	machinev1alpha1 "github.com/snapflowio/snapflow/libs/machine-proto/gen/go/machine/v1alpha1"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	runCommand    = "run"
	challengeFlag = "challenge"
	challengeHelp = "BenchmarkMachinePayload as proto3 JSON"
	diskDirectory = "/var/tmp"
	exitFailure   = 1
	usage         = "usage: machine-benchmark run --challenge <BenchmarkMachinePayload JSON>"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	err := run(ctx, os.Args[1:], os.Stdout)
	stop()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(exitFailure)
	}
}

func run(ctx context.Context, arguments []string, output io.Writer) error {
	challenge, err := parseChallenge(arguments)
	if err != nil {
		return err
	}
	runContext, cancel := context.WithDeadline(ctx, challenge.GetExpiresAt().AsTime())
	defer cancel()
	plan, err := suite.DefaultPlan(challenge.GetProfile(), diskDirectory)
	if err != nil {
		return err
	}
	measurements, err := suite.Run(runContext, challenge, plan)
	if err != nil {
		return err
	}
	encoded, err := protojson.Marshal(measurements)
	if err != nil {
		return fmt.Errorf("encode the benchmark measurements: %w", err)
	}
	if _, err := output.Write(encoded); err != nil {
		return fmt.Errorf("write the benchmark measurements: %w", err)
	}
	return nil
}

func parseChallenge(arguments []string) (*machinev1alpha1.BenchmarkMachinePayload, error) {
	if len(arguments) == 0 || arguments[0] != runCommand {
		return nil, errors.New(usage)
	}
	flags := flag.NewFlagSet(runCommand, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	encoded := flags.String(challengeFlag, "", challengeHelp)
	if err := flags.Parse(arguments[1:]); err != nil || *encoded == "" {
		return nil, errors.Join(errors.New(usage), err)
	}
	challenge := &machinev1alpha1.BenchmarkMachinePayload{}
	if err := protojson.Unmarshal([]byte(*encoded), challenge); err != nil {
		return nil, fmt.Errorf("decode the benchmark challenge: %w", err)
	}
	if challenge.GetExpiresAt() == nil {
		return nil, errors.New("the benchmark challenge has no expiry")
	}
	return challenge, nil
}
