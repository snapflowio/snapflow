package main

import (
	"fmt"
	golog "log"
	"os"
	"path/filepath"

	"github.com/rs/zerolog/log"
	"github.com/snapflowio/go-common/pkg/logger"
	"github.com/snapflowio/node/cmd/node/config"
	"github.com/snapflowio/node/pkg/terminal"
	"github.com/snapflowio/node/pkg/toolbox"
)

func main() {
	// Initialize logging first
	loggerConfig := logger.DefaultConfig()
	if logLevel := os.Getenv("LOG_LEVEL"); logLevel != "" {
		loggerConfig.Level = logLevel
	}

	if err := logger.Init(loggerConfig); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logging: %v\n", err)
		os.Exit(1)
	}

	c, err := config.GetConfig()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to get config")
	}

	c.ProjectDir = filepath.Join(os.Getenv("HOME"))

	if projectDir := os.Getenv("SNAPFLOW_PROJECT_DIR"); projectDir != "" {
		c.ProjectDir = projectDir
	}

	if _, err := os.Stat(c.ProjectDir); os.IsNotExist(err) {
		if err := os.MkdirAll(c.ProjectDir, 0755); err != nil {
			log.Fatal().Err(err).Msg("Failed to create project directory")
		}
	}

	// Handle file logging if configured
	if c.LogFilePath != nil {
		// For file logging, we would need to reconfigure the logger
		// But for now, just log that file logging is requested
		log.Info().Str("log_file", *c.LogFilePath).Msg("File logging configured")
	}

	// Redirect Go's standard logger to zerolog
	golog.SetFlags(0)
	golog.SetOutput(log.Logger)

	errChan := make(chan error)
	toolBoxServer := &toolbox.Server{
		ProjectDir: c.ProjectDir,
	}

	go func() {
		err := toolBoxServer.Start()
		if err != nil {
			errChan <- err
		}
	}()

	go func() {
		if err := terminal.StartTerminalServer(22222); err != nil {
			errChan <- err
		}
	}()

	err = <-errChan
	if err != nil {
		log.Fatal().Err(err).Msg("Application error")
	}
}
