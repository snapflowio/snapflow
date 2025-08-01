package middlewares

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/snapflowio/node/pkg/common"
)

func ErrorMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			err := next(c)
			if err != nil {
				he, ok := err.(*echo.HTTPError)
				if !ok {
					he = echo.NewHTTPError(http.StatusInternalServerError, err.Error())
				}

				statusCode := he.Code
				message := he.Message
				if msgStr, ok := message.(string); ok {
					message = msgStr
				} else if msgErr, ok := message.(error); ok {
					message = msgErr.Error()
				} else {
					message = "Internal Server Error"
				}

				errorResponse := common.ErrorResponse{
					StatusCode: statusCode,
					Message:    message.(string),
					Code:       http.StatusText(statusCode),
					Timestamp:  time.Now(),
					Path:       c.Request().URL.Path,
					Method:     c.Request().Method,
				}

				c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
				return c.JSON(statusCode, errorResponse)
			}
			return nil
		}
	}
}
