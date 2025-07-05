package timer

import (
	"runtime"
	"time"

	log "github.com/sirupsen/logrus"
)

func callerName(skip int) string {
	const unknown = "unknown"
	pcs := make([]uintptr, 1)
	n := runtime.Callers(skip+2, pcs)
	if n < 1 {
		return unknown
	}

	frame, _ := runtime.CallersFrames(pcs).Next()
	if frame.Function == "" {
		return unknown
	}

	return frame.Function
}

func Timer() func() {
	name := callerName(1)
	start := time.Now()
	return func() {
		log.Tracef("%s took %v", name, time.Since(start))
	}
}
