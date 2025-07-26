package middlewares

import (
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog/log"
)

var ignoreLoggingPaths = map[string]bool{
	"/metrics": true,
	"/":        true,
}

func LoggingMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			startTime := time.Now()

			method := c.Request().Method
			path := c.Request().URL.Path
			requestURI := c.Request().RequestURI

			// Process request
			err := next(c)

			// Calculate latency
			latency := time.Since(startTime)

			// Get response status
			status := c.Response().Status

			// Create log event
			logEvent := log.With().
				Str("method", method).
				Str("path", path).
				Str("uri", requestURI).
				Int("status", status).
				Int64("latency_ms", latency.Milliseconds()).
				Str("latency", latency.String()).
				Str("ip", c.RealIP()).
				Logger()

			if err != nil {
				logEvent = logEvent.With().Err(err).Logger()
			}

			if ignoreLoggingPaths[path] && status < 400 {
				logEvent.Debug().Msg("API Request")
			} else if status >= 500 {
				logEvent.Error().Msg("API Request Failed")
			} else if status >= 400 {
				logEvent.Warn().Msg("API Request Error")
			} else {
				logEvent.Info().Msg("API Request")
			}

			return err
		}
	}
}
