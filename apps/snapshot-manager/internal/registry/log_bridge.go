// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package registry

import (
	"context"
	"io"
	"log/slog"

	"github.com/sirupsen/logrus"
)

func BridgeLogs(logger *slog.Logger) {
	logrus.SetOutput(io.Discard)
	logrus.SetLevel(logrus.TraceLevel)
	logrus.StandardLogger().ReplaceHooks(make(logrus.LevelHooks))
	logrus.AddHook(&slogHook{logger: logger})
}

type slogHook struct {
	logger *slog.Logger
}

func (hook *slogHook) Levels() []logrus.Level {
	return logrus.AllLevels
}

func (hook *slogHook) Fire(entry *logrus.Entry) error {
	attributes := make([]slog.Attr, 0, len(entry.Data))
	for key, value := range entry.Data {
		attributes = append(attributes, slog.Any(key, value))
	}
	ctx := entry.Context
	if ctx == nil {
		ctx = context.Background()
	}
	hook.logger.LogAttrs(ctx, slogLevel(entry.Level), entry.Message, attributes...)
	return nil
}

func slogLevel(level logrus.Level) slog.Level {
	switch level {
	case logrus.TraceLevel, logrus.DebugLevel:
		return slog.LevelDebug
	case logrus.WarnLevel:
		return slog.LevelWarn
	case logrus.ErrorLevel, logrus.FatalLevel, logrus.PanicLevel:
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
