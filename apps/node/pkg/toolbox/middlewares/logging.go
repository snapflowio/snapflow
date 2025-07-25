package middlewares

import (
	"time"

	"github.com/labstack/echo/v4"
	log "github.com/sirupsen/logrus"
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
				log.WithFields(log.Fields{
					"method":  reqMethod,
					"URI":     reqUri,
					"status":  statusCode,
					"latency": latencyTime,
					"error":   err.Error(),
				}).Error("API ERROR")
			} else {
				fullPath := c.Path()
				if ignoreLoggingPaths[fullPath] {
					log.WithFields(log.Fields{
						"method":  reqMethod,
						"URI":     reqUri,
						"status":  statusCode,
						"latency": latencyTime,
					}).Debug("API REQUEST")
				} else {
					log.WithFields(log.Fields{
						"method":  reqMethod,
						"URI":     reqUri,
						"status":  statusCode,
						"latency": latencyTime,
					}).Info("API REQUEST")
				}
			}
			return err
		}
	}
}
