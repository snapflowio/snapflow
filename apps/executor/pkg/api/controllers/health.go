package controllers

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// HealthCheck 			godoc
//
//	@Summary		Health check
//	@Description	Health check
//	@Produce		json
//	@Success		200	{object}	map[string]string
//	@Router			/ [get]
//
//	@id				HealthCheck
func HealthCheck(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"status":  "ok",
		"version": "0.0.1",
	})
}
