package util

import (
	"io"

	log "github.com/sirupsen/logrus"
)

type LogFormatter struct {
	TextFormatter    *log.TextFormatter
	ProcessLogWriter io.Writer
}

func (f *LogFormatter) Format(entry *log.Entry) ([]byte, error) {
	formatted, err := f.TextFormatter.Format(entry)
	if err != nil {
		return nil, err
	}

	if f.ProcessLogWriter != nil {
		_, err = f.ProcessLogWriter.Write(formatted)
		if err != nil {
			return nil, err
		}
	}

	return []byte(entry.Message + "\n"), nil
}
