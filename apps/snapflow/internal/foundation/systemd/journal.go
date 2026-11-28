// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package systemd

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sync"

	"github.com/coreos/go-systemd/v22/journal"
)

const priorityPrefix = "<%d>"

func StdoutIsJournal() (bool, error) {
	connected, err := journal.StdoutIsJournalStream()
	if err != nil {
		return false, fmt.Errorf("detect the journal stream: %w", err)
	}
	return connected, nil
}

type JournalHandler struct {
	inner  slog.Handler
	output *priorityWriter
}

var _ slog.Handler = (*JournalHandler)(nil)

func NewJournalHandler(writer io.Writer, level slog.Leveler) *JournalHandler {
	output := &priorityWriter{writer: writer}
	inner := slog.NewTextHandler(output, &slog.HandlerOptions{Level: level, ReplaceAttr: dropJournalFields})
	return &JournalHandler{inner: inner, output: output}
}

func (handler *JournalHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return handler.inner.Enabled(ctx, level)
}

func (handler *JournalHandler) Handle(ctx context.Context, record slog.Record) error {
	handler.output.mu.Lock()
	defer handler.output.mu.Unlock()
	handler.output.priority = journalPriority(record.Level)
	return handler.inner.Handle(ctx, record)
}

func (handler *JournalHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &JournalHandler{inner: handler.inner.WithAttrs(attrs), output: handler.output}
}

func (handler *JournalHandler) WithGroup(name string) slog.Handler {
	return &JournalHandler{inner: handler.inner.WithGroup(name), output: handler.output}
}

type priorityWriter struct {
	mu       sync.Mutex
	writer   io.Writer
	priority journal.Priority
}

func (output *priorityWriter) Write(record []byte) (int, error) {
	line := append(fmt.Appendf(nil, priorityPrefix, output.priority), record...)
	if _, err := output.writer.Write(line); err != nil {
		return 0, err
	}
	return len(record), nil
}

func journalPriority(level slog.Level) journal.Priority {
	switch {
	case level < slog.LevelInfo:
		return journal.PriDebug
	case level < slog.LevelWarn:
		return journal.PriInfo
	case level < slog.LevelError:
		return journal.PriWarning
	default:
		return journal.PriErr
	}
}

func dropJournalFields(groups []string, attr slog.Attr) slog.Attr {
	if len(groups) == 0 && (attr.Key == slog.TimeKey || attr.Key == slog.LevelKey) {
		return slog.Attr{}
	}
	return attr
}
