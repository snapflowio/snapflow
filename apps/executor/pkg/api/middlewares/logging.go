package middlewares

import (
	"time"

	"github.com/labstack/echo/v4"
	log "github.com/sirupsen/logrus"
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

			// Create log fields
			fields := log.Fields{
				"method":     method,
				"path":       path,
				"uri":        requestURI,
				"status":     status,
				"latency_ms": latency.Milliseconds(),
				"latency":    latency.String(),
				"ip":         c.RealIP(),
			}

			if err != nil {
				fields["error"] = err.Error()
			}

			if ignoreLoggingPaths[path] && status < 400 {
				log.WithFields(fields).Debug("API Request")
			} else if status >= 500 {
				log.WithFields(fields).Error("API Request Failed")
			} else if status >= 400 {
				log.WithFields(fields).Warn("API Request Error")
			} else {
				log.WithFields(fields).Info("API Request")
			}

			return err
		}
	}
}
