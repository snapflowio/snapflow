// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package computeruse

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/snapflowio/computer-use/plugin"

	"github.com/labstack/echo/v5"
)

func parseRequiredIntQuery(c *echo.Context, key string) (int, error) {
	value, ok := queryValue(c, key)
	if !ok {
		return 0, fmt.Errorf("missing required query parameter: %s", key)
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("invalid query parameter %s: must be an integer", key)
	}

	return parsed, nil
}

func parseRequiredPositiveIntQuery(c *echo.Context, key string) (int, error) {
	parsed, err := parseRequiredIntQuery(c, key)
	if err != nil {
		return 0, err
	}
	if parsed <= 0 {
		return 0, fmt.Errorf("invalid query parameter %s: must be greater than zero", key)
	}

	return parsed, nil
}

func parseBoolQueryValue(key, value string) (bool, error) {
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("invalid query parameter %s: must be a boolean", key)
	}

	return parsed, nil
}

func parseShowCursorQuery(c *echo.Context) (bool, error) {
	if value, ok := queryValue(c, "show_cursor"); ok {
		return parseBoolQueryValue("show_cursor", value)
	}
	if value, ok := queryValue(c, "showCursor"); ok {
		return parseBoolQueryValue("showCursor", value)
	}

	return false, nil
}

const defaultCompressionQuality = 85

func parseOptionalQualityQuery(c *echo.Context) (int, error) {
	value, ok := queryValue(c, "quality")
	if !ok {
		return defaultCompressionQuality, nil
	}

	quality, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("invalid query parameter quality: must be an integer")
	}
	if quality < 1 || quality > 100 {
		return 0, fmt.Errorf("invalid query parameter quality: must be between 1 and 100")
	}

	return quality, nil
}

func parseOptionalScaleQuery(c *echo.Context) (float64, error) {
	value, ok := queryValue(c, "scale")
	if !ok {
		return 1.0, nil
	}

	scale, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid query parameter scale: must be a number")
	}
	if scale < 0.1 || scale > 1.0 {
		return 0, fmt.Errorf("invalid query parameter scale: must be between 0.1 and 1.0")
	}

	return scale, nil
}

func parseRegionScreenshotRequest(c *echo.Context) (*plugin.RegionScreenshotRequest, error) {
	x, err := parseRequiredIntQuery(c, "x")
	if err != nil {
		return nil, err
	}
	y, err := parseRequiredIntQuery(c, "y")
	if err != nil {
		return nil, err
	}
	width, err := parseRequiredPositiveIntQuery(c, "width")
	if err != nil {
		return nil, err
	}
	height, err := parseRequiredPositiveIntQuery(c, "height")
	if err != nil {
		return nil, err
	}
	showCursor, err := parseShowCursorQuery(c)
	if err != nil {
		return nil, err
	}

	return &plugin.RegionScreenshotRequest{
		Position: plugin.Position{
			X: x,
			Y: y,
		},
		Size: plugin.Size{
			Width:  width,
			Height: height,
		},
		ShowCursor: showCursor,
	}, nil
}

func parseCompressedScreenshotRequest(c *echo.Context) (*plugin.CompressedScreenshotRequest, error) {
	showCursor, err := parseShowCursorQuery(c)
	if err != nil {
		return nil, err
	}
	quality, err := parseOptionalQualityQuery(c)
	if err != nil {
		return nil, err
	}
	scale, err := parseOptionalScaleQuery(c)
	if err != nil {
		return nil, err
	}

	return &plugin.CompressedScreenshotRequest{
		ShowCursor: showCursor,
		Format:     queryValueOr(c, "format", "png"),
		Quality:    quality,
		Scale:      scale,
	}, nil
}

func parseCompressedRegionScreenshotRequest(c *echo.Context) (*plugin.CompressedRegionScreenshotRequest, error) {
	regionReq, err := parseRegionScreenshotRequest(c)
	if err != nil {
		return nil, err
	}
	quality, err := parseOptionalQualityQuery(c)
	if err != nil {
		return nil, err
	}
	scale, err := parseOptionalScaleQuery(c)
	if err != nil {
		return nil, err
	}

	return &plugin.CompressedRegionScreenshotRequest{
		Position:   regionReq.Position,
		Size:       regionReq.Size,
		ShowCursor: regionReq.ShowCursor,
		Format:     queryValueOr(c, "format", "png"),
		Quality:    quality,
		Scale:      scale,
	}, nil
}

func queryValue(c *echo.Context, key string) (string, bool) {
	values := c.Request().URL.Query()
	value, found := values[key]
	if !found || len(value) == 0 {
		return "", false
	}
	return value[0], true
}

func queryValueOr(c *echo.Context, key, fallback string) string {
	value, found := queryValue(c, key)
	if !found {
		return fallback
	}
	return value
}

// @Summary		Take a screenshot
// @Description	Take a screenshot of the entire screen
// @Tags			computer-use
// @Produce		json
// @Param			showCursor	query		bool	false	"Whether to show cursor in screenshot"
// @Success		200			{object}	plugin.ScreenshotResponse
// @Router			/computeruse/screenshot [get]
// @id				TakeScreenshot
func WrapScreenshotHandler(fn func(*plugin.ScreenshotRequest) (*plugin.ScreenshotResponse, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		showCursor, err := parseShowCursorQuery(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
		}

		req := &plugin.ScreenshotRequest{
			ShowCursor: showCursor,
		}
		response, err := fn(req)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, response)
	}
}

// @Summary		Take a region screenshot
// @Description	Take a screenshot of a specific region of the screen
// @Tags			computer-use
// @Produce		json
// @Param			x			query		int		true	"X coordinate of the region"
// @Param			y			query		int		true	"Y coordinate of the region"
// @Param			width		query		int		true	"Width of the region"
// @Param			height		query		int		true	"Height of the region"
// @Param			showCursor	query		bool	false	"Whether to show cursor in screenshot"
// @Success		200			{object}	plugin.ScreenshotResponse
// @Router			/computeruse/screenshot/region [get]
// @id				TakeRegionScreenshot
func WrapRegionScreenshotHandler(fn func(*plugin.RegionScreenshotRequest) (*plugin.ScreenshotResponse, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		req, err := parseRegionScreenshotRequest(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
		}

		response, err := fn(req)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, response)
	}
}

// @Summary		Take a compressed screenshot
// @Description	Take a compressed screenshot of the entire screen
// @Tags			computer-use
// @Produce		json
// @Param			showCursor	query		bool	false	"Whether to show cursor in screenshot"
// @Param			format		query		string	false	"Image format (png or jpeg)"
// @Param			quality		query		int		false	"JPEG quality (1-100)"
// @Param			scale		query		float64	false	"Scale factor (0.1-1.0)"
// @Success		200			{object}	plugin.ScreenshotResponse
// @Router			/computeruse/screenshot/compressed [get]
// @id				TakeCompressedScreenshot
func WrapCompressedScreenshotHandler(fn func(*plugin.CompressedScreenshotRequest) (*plugin.ScreenshotResponse, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		req, err := parseCompressedScreenshotRequest(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
		}

		response, err := fn(req)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, response)
	}
}

// @Summary		Take a compressed region screenshot
// @Description	Take a compressed screenshot of a specific region of the screen
// @Tags			computer-use
// @Produce		json
// @Param			x			query		int		true	"X coordinate of the region"
// @Param			y			query		int		true	"Y coordinate of the region"
// @Param			width		query		int		true	"Width of the region"
// @Param			height		query		int		true	"Height of the region"
// @Param			showCursor	query		bool	false	"Whether to show cursor in screenshot"
// @Param			format		query		string	false	"Image format (png or jpeg)"
// @Param			quality		query		int		false	"JPEG quality (1-100)"
// @Param			scale		query		float64	false	"Scale factor (0.1-1.0)"
// @Success		200			{object}	plugin.ScreenshotResponse
// @Router			/computeruse/screenshot/region/compressed [get]
// @id				TakeCompressedRegionScreenshot
func WrapCompressedRegionScreenshotHandler(fn func(*plugin.CompressedRegionScreenshotRequest) (*plugin.ScreenshotResponse, error)) echo.HandlerFunc {
	return func(c *echo.Context) error {
		req, err := parseCompressedRegionScreenshotRequest(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
		}

		response, err := fn(req)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]any{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, response)
	}
}
