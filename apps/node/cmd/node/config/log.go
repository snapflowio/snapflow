package config

import (
	"io"
)

type LogFormatter struct {
	LogFileWriter io.Writer
}

// LogFormatter is no longer needed with zerolog as it handles formatting internally
// This struct is kept for backward compatibility but should be refactored
type LogWriter struct {
	LogFileWriter io.Writer
}

func (w *LogWriter) Write(p []byte) (n int, err error) {
	if w.LogFileWriter != nil {
		return w.LogFileWriter.Write(p)
	}
	return len(p), nil
}
