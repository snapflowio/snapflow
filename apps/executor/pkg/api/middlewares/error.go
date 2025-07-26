package middlewares

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/docker/docker/errdefs"
	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog/log"
	"github.com/snapflow/executor/internal/util"
	"github.com/snapflow/executor/pkg/common"
)

func ErrorMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			err := next(c)
			if err == nil {
				return nil
			}

			var errorResponse common.ErrorResponse

			// Handle Echo HTTP errors
			if he, ok := err.(*echo.HTTPError); ok {
				errorResponse = common.ErrorResponse{
					StatusCode: he.Code,
					Message:    fmt.Sprintf("%v", he.Message),
					Code:       httpStatusToCode(he.Code),
					Timestamp:  time.Now(),
					Path:       c.Request().URL.Path,
					Method:     c.Request().Method,
				}
			} else {
				// Handle custom errors
				switch e := err.(type) {
				case *common.CustomError:
					errorResponse = common.ErrorResponse{
						StatusCode: e.StatusCode,
						Message:    e.Message,
						Code:       e.Code,
						Timestamp:  time.Now(),
						Path:       c.Request().URL.Path,
						Method:     c.Request().Method,
					}
				case *common.NotFoundError:
					errorResponse = common.ErrorResponse{
						StatusCode: http.StatusNotFound,
						Message:    e.Error(),
						Code:       "NOT_FOUND",
						Timestamp:  time.Now(),
						Path:       c.Request().URL.Path,
						Method:     c.Request().Method,
					}
				case *common.UnauthorizedError:
					errorResponse = common.ErrorResponse{
						StatusCode: http.StatusUnauthorized,
						Message:    e.Error(),
						Code:       "UNAUTHORIZED",
						Timestamp:  time.Now(),
						Path:       c.Request().URL.Path,
						Method:     c.Request().Method,
					}
				case *common.InvalidBodyRequestError:
					errorResponse = common.ErrorResponse{
						StatusCode: http.StatusBadRequest,
						Message:    e.Error(),
						Code:       "INVALID_REQUEST_BODY",
						Timestamp:  time.Now(),
						Path:       c.Request().URL.Path,
						Method:     c.Request().Method,
					}
				case *common.ConflictError:
					errorResponse = common.ErrorResponse{
						StatusCode: http.StatusConflict,
						Message:    e.Error(),
						Code:       "CONFLICT",
						Timestamp:  time.Now(),
						Path:       c.Request().URL.Path,
						Method:     c.Request().Method,
					}
				case *common.BadRequestError:
					errorResponse = common.ErrorResponse{
						StatusCode: http.StatusBadRequest,
						Message:    util.ExtractErrorPart(e.Error()),
						Code:       "BAD_REQUEST",
						Timestamp:  time.Now(),
						Path:       c.Request().URL.Path,
						Method:     c.Request().Method,
					}
				default:
					errorResponse = handlePossibleDockerError(c, err)
				}
			}

			if errorResponse.StatusCode == http.StatusInternalServerError {
				log.Error().
					Err(err).
					Str("path", c.Request().URL.Path).
					Str("method", c.Request().Method).
					Msg("Internal Server Error")
			} else {
				log.Error().
					Str("method", c.Request().Method).
					Str("URI", c.Request().URL.Path).
					Int("status", errorResponse.StatusCode).
					Str("error", errorResponse.Message).
					Msg("API ERROR")
			}

			return c.JSON(errorResponse.StatusCode, errorResponse)
		}
	}
}

func handlePossibleDockerError(c echo.Context, err error) common.ErrorResponse {
	if errdefs.IsNotFound(err) {
		return common.ErrorResponse{
			StatusCode: http.StatusNotFound,
			Message:    fmt.Sprintf("resource not found: %s", err.Error()),
			Code:       "NOT_FOUND",
			Timestamp:  time.Now(),
			Path:       c.Request().URL.Path,
			Method:     c.Request().Method,
		}
	} else if errdefs.IsUnauthorized(err) || strings.Contains(err.Error(), "unauthorized") {
		return common.ErrorResponse{
			StatusCode: http.StatusUnauthorized,
			Message:    fmt.Sprintf("unauthorized: %s", err.Error()),
			Code:       "UNAUTHORIZED",
			Timestamp:  time.Now(),
			Path:       c.Request().URL.Path,
			Method:     c.Request().Method,
		}
	} else if errdefs.IsConflict(err) {
		return common.ErrorResponse{
			StatusCode: http.StatusConflict,
			Message:    fmt.Sprintf("conflict: %s", err.Error()),
			Code:       "CONFLICT",
			Timestamp:  time.Now(),
			Path:       c.Request().URL.Path,
			Method:     c.Request().Method,
		}
	} else if errdefs.IsInvalidParameter(err) {
		return common.ErrorResponse{
			StatusCode: http.StatusBadRequest,
			Message:    fmt.Sprintf("bad request: %s", err.Error()),
			Code:       "BAD_REQUEST",
			Timestamp:  time.Now(),
			Path:       c.Request().URL.Path,
			Method:     c.Request().Method,
		}
	} else if errdefs.IsSystem(err) {
		if strings.Contains(err.Error(), "unable to find user") {
			return common.ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Message:    util.ExtractErrorPart(err.Error()),
				Code:       "BAD_REQUEST",
				Timestamp:  time.Now(),
				Path:       c.Request().URL.Path,
				Method:     c.Request().Method,
			}
		}
	}

	return common.ErrorResponse{
		StatusCode: http.StatusInternalServerError,
		Message:    err.Error(),
		Code:       "INTERNAL_SERVER_ERROR",
		Timestamp:  time.Now(),
		Path:       c.Request().URL.Path,
		Method:     c.Request().Method,
	}
}

func httpStatusToCode(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "BAD_REQUEST"
	case http.StatusUnauthorized:
		return "UNAUTHORIZED"
	case http.StatusNotFound:
		return "NOT_FOUND"
	case http.StatusConflict:
		return "CONFLICT"
	default:
		return "INTERNAL_SERVER_ERROR"
	}
}
