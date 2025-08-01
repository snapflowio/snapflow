package middlewares

import (
	"net/http"
	"os"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/snapflowio/executor/internal/constants"
)

func AuthMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get(constants.SNAPFLOW_AUTHORIZATION_HEADER)
			if authHeader == "" {
				authHeader = c.Request().Header.Get(constants.AUTHORIZATION_HEADER)
			}

			if authHeader == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "authorization header required")
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != constants.BEARER_AUTH_HEADER {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid authorization header format")
			}

			token := parts[1]
			if token != os.Getenv("API_TOKEN") {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
			}

			return next(c)
		}
	}
}
