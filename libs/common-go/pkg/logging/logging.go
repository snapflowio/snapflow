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

package logging

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"

	"github.com/lmittmann/tint"
)

const (
	LevelEnvironmentVariable = "SNAPFLOW_LOG_LEVEL"
	consoleTimeFormat        = "2006-01-02T15:04:05.000Z07:00"
)

type Options struct {
	Level     slog.Leveler
	Writer    io.Writer
	JSON      bool
	AddSource bool
	NoColor   bool
}

func New(options Options) *slog.Logger {
	return slog.New(NewHandler(options))
}

func NewHandler(options Options) slog.Handler {
	writer := options.Writer
	if writer == nil {
		writer = os.Stderr
	}
	if options.JSON {
		return slog.NewJSONHandler(writer, &slog.HandlerOptions{
			AddSource: options.AddSource,
			Level:     options.Level,
		})
	}
	return tint.NewTextHandler(writer, &tint.Options{
		AddSource:   options.AddSource,
		Level:       options.Level,
		NoColor:     options.NoColor,
		TimeFormat:  consoleTimeFormat,
		ReplaceAttr: colorLevel,
	})
}

func EnvironmentLevel(fallback slog.Level) (slog.Level, error) {
	value := strings.TrimSpace(os.Getenv(LevelEnvironmentVariable))
	if value == "" {
		return fallback, nil
	}
	level, err := ParseLevel(value)
	if err != nil {
		return fallback, fmt.Errorf("%s: %w", LevelEnvironmentVariable, err)
	}
	return level, nil
}

func ParseLevel(value string) (slog.Level, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return slog.LevelInfo, nil
	}
	if strings.EqualFold(value, "warning") {
		value = "WARN"
	}

	var level slog.Level
	if err := level.UnmarshalText([]byte(value)); err != nil {
		return slog.LevelInfo, fmt.Errorf("parse log level %q: %w", value, err)
	}
	return level, nil
}

func colorLevel(groups []string, attribute slog.Attr) slog.Attr {
	if len(groups) != 0 || attribute.Key != slog.LevelKey {
		return attribute
	}
	level, ok := attribute.Value.Any().(slog.Level)
	if !ok {
		return attribute
	}
	return tint.Attr(
		levelColor(level),
		slog.String(slog.LevelKey, level.String()),
	)
}

const (
	debugColor   uint8 = 12
	infoColor    uint8 = 10
	warningColor uint8 = 11
	errorColor   uint8 = 9
)

func levelColor(level slog.Level) uint8 {
	switch {
	case level <= slog.LevelDebug:
		return debugColor
	case level <= slog.LevelInfo:
		return infoColor
	case level <= slog.LevelWarn:
		return warningColor
	default:
		return errorColor
	}
}

func SetDefault(options Options) *slog.Logger {
	logger := New(options)
	slog.SetDefault(logger)
	return logger
}
