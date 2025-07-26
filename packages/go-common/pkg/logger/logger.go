package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func colorize(s string, color int, noColor bool) string {
	if noColor {
		return s
	}
	return fmt.Sprintf("\x1b[%dm%s\x1b[0m", color, s)
}

type Config struct {
	Level      string
	Format     string
	Output     string
	TimeFormat string
	NoColor    bool
}

func DefaultConfig() Config {
	return Config{
		Level:      "info",
		Format:     "console",
		Output:     "stdout",
		TimeFormat: time.RFC3339,
		NoColor:    false,
	}
}

func Init(cfg Config) error {
	level, err := zerolog.ParseLevel(cfg.Level)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	zerolog.TimeFieldFormat = cfg.TimeFormat

	var output io.Writer
	switch strings.ToLower(cfg.Output) {
	case "stdout":
		output = os.Stdout
	case "stderr":
		output = os.Stderr
	default:
		logDir := filepath.Dir(cfg.Output)
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return fmt.Errorf("failed to create log directory: %w", err)
		}
		file, err := os.OpenFile(cfg.Output, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			return fmt.Errorf("failed to open log file: %w", err)
		}
		output = io.MultiWriter(os.Stdout, file)
	}

	if cfg.Format == "console" {
		output = zerolog.ConsoleWriter{
			Out:        output,
			TimeFormat: cfg.TimeFormat,
			NoColor:    cfg.NoColor,
			FormatLevel: func(i interface{}) string {
				var l string
				if ll, ok := i.(string); ok {
					switch ll {
					case "trace":
						l = colorize("TRACE", 34, cfg.NoColor) // blue
					case "debug":
						l = colorize("DEBUG", 36, cfg.NoColor) // cyan
					case "info":
						l = colorize("INFO", 32, cfg.NoColor) // green
					case "warn":
						l = colorize("WARN", 33, cfg.NoColor) // yellow
					case "error":
						l = colorize("ERROR", 31, cfg.NoColor) // red
					case "fatal":
						l = colorize("FATAL", 35, cfg.NoColor) // magenta
					case "panic":
						l = colorize("PANIC", 35, cfg.NoColor) // magenta
					default:
						l = colorize(strings.ToUpper(ll), 0, cfg.NoColor)
					}
				} else {
					l = strings.ToUpper(fmt.Sprintf("%v", i))
				}
				return l
			},
		}
	}

	log.Logger = zerolog.New(output).With().Timestamp().Logger()

	return nil
}

func GetLogger(name string) zerolog.Logger {
	return log.With().Str("component", name).Logger()
}

func WithFields(fields map[string]any) zerolog.Logger {
	ctx := log.With()
	for k, v := range fields {
		ctx = ctx.Interface(k, v)
	}
	return ctx.Logger()
}
