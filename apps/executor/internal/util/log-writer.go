package util

import (
	"github.com/rs/zerolog/log"
)

type DebugLogWriter struct{}

func (w *DebugLogWriter) Write(p []byte) (n int, err error) {
	log.Debug().Msg(string(p))
	return len(p), nil
}

type InfoLogWriter struct{}

func (w *InfoLogWriter) Write(p []byte) (n int, err error) {
	log.Info().Msg(string(p))
	return len(p), nil
}

type TraceLogWriter struct{}

func (w *TraceLogWriter) Write(p []byte) (n int, err error) {
	log.Trace().Msg(string(p))
	return len(p), nil
}

type ErrorLogWriter struct{}

func (w *ErrorLogWriter) Write(p []byte) (n int, err error) {
	log.Error().Msg(string(p))
	return len(p), nil
}
