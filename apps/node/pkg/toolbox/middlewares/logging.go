package middlewares

import (
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog/log"
)

var ignoreLoggingPaths = map[string]bool{}

func LoggingMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			startTime := time.Now()
			err := next(c)
			endTime := time.Now()
			latencyTime := endTime.Sub(startTime)
			reqMethod := c.Request().Method
			reqUri := c.Request().RequestURI
			statusCode := c.Response().Status

			if err != nil {
				log.Error().
					Str("method", reqMethod).
					Str("URI", reqUri).
					Int("status", statusCode).
					Dur("latency", latencyTime).
					Err(err).
					Msg("API ERROR")
			} else {
				fullPath := c.Path()
				if ignoreLoggingPaths[fullPath] {
					log.Debug().
						Str("method", reqMethod).
						Str("URI", reqUri).
						Int("status", statusCode).
						Dur("latency", latencyTime).
						Msg("API REQUEST")
				} else {
					log.Info().
						Str("method", reqMethod).
						Str("URI", reqUri).
						Int("status", statusCode).
						Dur("latency", latencyTime).
						Msg("API REQUEST")
				}
			}
			return err
		}
	}
}
