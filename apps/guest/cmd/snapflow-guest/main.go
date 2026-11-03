// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/snapflowio/common-go/pkg/guestspec"
	"github.com/snapflowio/common-go/pkg/logging"
	"github.com/snapflowio/guest/cmd/snapflow-guest/config"
	"github.com/snapflowio/guest/internal/childreap"
	"github.com/snapflowio/guest/internal/lifecycle"
	"github.com/snapflowio/guest/internal/session"
	"github.com/snapflowio/guest/internal/ssh"
	"github.com/snapflowio/guest/internal/terminal"
	"github.com/snapflowio/guest/internal/toolbox"
	"github.com/snapflowio/guest/internal/util"
	"golang.org/x/sync/errgroup"
	"gopkg.in/natefinch/lumberjack.v2"
)

const (
	exitSuccess            = 0
	exitRuntimeError       = 1
	exitConfigurationError = 2
	configDirectoryName    = ".snapflow"
	configDirectoryMode    = 0o755
	entrypointCommand      = "entrypoint"
	entrypointLogsCommand  = "logs"
)

type component struct {
	name string
	run  func(context.Context) error
}

func main() {
	os.Exit(run())
}

func run() int {
	consoleHandler := logging.NewHandler(logging.Options{Writer: os.Stdout, Level: logging.BuildLevel})
	logger := slog.New(consoleHandler)
	slog.SetDefault(logger)
	slog.SetLogLoggerLevel(slog.LevelDebug)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	configDir, err := prepareConfigDirectory()
	if err != nil {
		logger.Error("Failed to prepare the configuration directory", "error", err)
		return exitConfigurationError
	}
	args := os.Args[1:]
	if len(args) == 2 && args[0] == entrypointCommand && args[1] == entrypointLogsCommand {
		return printEntrypointLogs(ctx, logger, configDir)
	}

	cfg, err := config.Load()
	if err != nil {
		logger.Error("Failed to get config", "error", err)
		return exitConfigurationError
	}
	logWriter := &lumberjack.Logger{
		Filename:   guestspec.LogFilePath,
		MaxSize:    guestspec.LogMaxSizeMB,
		MaxAge:     guestspec.LogMaxAgeDays,
		MaxBackups: guestspec.LogMaxBackups,
		LocalTime:  true,
		Compress:   guestspec.LogCompress,
	}
	defer func() {
		if err := logWriter.Close(); err != nil {
			logger.Error("Failed to close daemon log file", "path", guestspec.LogFilePath, "error", err)
		}
	}()
	fileHandler := logging.NewHandler(logging.Options{Writer: logWriter, Level: logging.BuildLevel, NoColor: true})
	logger = slog.New(logging.NewMultiHandler(consoleHandler, fileHandler))
	slog.SetDefault(logger)
	reaper := childreap.New()
	reaper.Start()

	if err := serve(ctx, logger, reaper, cfg, configDir, args); err != nil {
		logger.Error("Guest daemon stopped", "error", err)
		return exitRuntimeError
	}
	logger.Info("Shutdown complete")
	return exitSuccess
}

func prepareConfigDirectory() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve the home directory: %w", err)
	}
	configDir := filepath.Join(homeDir, configDirectoryName)
	if err := os.MkdirAll(configDir, configDirectoryMode); err != nil {
		return "", fmt.Errorf("create %s: %w", configDir, err)
	}
	return configDir, nil
}

func printEntrypointLogs(ctx context.Context, logger *slog.Logger, configDir string) int {
	err := session.PrintEntrypointLogs(ctx, configDir, os.Stdout, os.Stderr)
	switch {
	case err == nil:
		return exitSuccess
	case errors.Is(err, os.ErrNotExist):
		logger.Warn("Logs not found, please check if correct entrypoint was provided for sandbox.")
	default:
		logger.Error("Failed to read entrypoint log file", "error", err)
	}
	return exitRuntimeError
}

func serve(ctx context.Context, logger *slog.Logger, reaper *childreap.Reaper, cfg config.Config, configDir string, args []string) error {
	workDir, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("resolve the working directory: %w", err)
	}
	sessions := session.New(session.Config{
		ConfigDir:                configDir,
		TerminationGracePeriod:   guestspec.TerminationGracePeriod,
		TerminationCheckInterval: guestspec.TerminationCheckInterval,
	}, session.Dependencies{Logger: logger, Reaper: reaper})
	if len(args) > 0 {
		cleanup, err := startEntrypoint(ctx, logger, sessions, args)
		if err != nil {
			return err
		}
		defer cleanup()
	}
	return supervise(ctx, []component{
		{name: "lifecycle", run: lifecycle.New(logger, guestspec.LifecycleSocket).Run},
		{name: "toolbox", run: toolbox.New(toolbox.Config{
			WorkDir:               workDir,
			ComputerUsePluginPath: cfg.ComputerUsePluginPath,
			AuthTokenFile:         guestspec.ToolboxCredentialFile,
			AuthHeader:            guestspec.AuthHeader,
			BindAddress:           cfg.BindAddress,
		}, toolbox.Dependencies{Logger: logger, Reaper: reaper, Sessions: sessions}).Run},
		{name: "terminal", run: terminal.New(terminal.Config{
			BindAddress:   cfg.BindAddress,
			AuthHeader:    guestspec.AuthHeader,
			AuthTokenFile: guestspec.TerminalCredentialFile,
		}, terminal.Dependencies{Logger: logger, Reaper: reaper}).Run},
		{name: "ssh", run: ssh.New(ssh.Config{
			WorkDir:       workDir,
			AuthTokenFile: guestspec.SSHCredentialFile,
			BindAddress:   cfg.BindAddress,
		}, ssh.Dependencies{Logger: logger, Reaper: reaper}).Run},
	})
}

func startEntrypoint(ctx context.Context, logger *slog.Logger, sessions *session.Service, args []string) (func(), error) {
	if err := sessions.Create(ctx, session.EntrypointID); err != nil {
		return nil, fmt.Errorf("create the entrypoint session: %w", err)
	}
	cleanup := func() {
		if err := sessions.Delete(context.WithoutCancel(ctx), session.EntrypointID); err != nil {
			logger.Error("Failed to delete entrypoint session", "error", err)
		}
	}
	started, err := sessions.Execute(ctx, session.EntrypointID, session.EntrypointCommand, util.ShellQuoteJoin(args), true, true)
	if err != nil {
		cleanup()
		return nil, fmt.Errorf("execute the entrypoint command: %w", err)
	}
	logger.Debug("Started entrypoint command", "command_id", started.CommandID)
	return cleanup, nil
}

func supervise(ctx context.Context, components []component) error {
	group, groupContext := errgroup.WithContext(ctx)
	for _, registered := range components {
		group.Go(func() error {
			err := registered.run(groupContext)
			switch {
			case err != nil:
				return fmt.Errorf("%s: %w", registered.name, err)
			case groupContext.Err() == nil:
				return fmt.Errorf("%s stopped unexpectedly", registered.name)
			default:
				return nil
			}
		})
	}
	return group.Wait()
}
