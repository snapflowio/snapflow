package fs

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/labstack/echo/v4"
)

func ReplaceInFiles(c echo.Context) error {
	var req ReplaceRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	results := make([]ReplaceResult, 0, len(req.Files))

	for _, filePath := range req.Files {
		content, err := os.ReadFile(filePath)
		if err != nil {
			results = append(results, ReplaceResult{
				File:    filePath,
				Success: false,
				Error:   err.Error(),
			})
			continue
		}

		newValue := ""
		if req.NewValue != nil {
			newValue = *req.NewValue
		}

		newContent := strings.ReplaceAll(string(content), req.Pattern, newValue)

		err = os.WriteFile(filePath, []byte(newContent), 0644)
		if err != nil {
			results = append(results, ReplaceResult{
				File:    filePath,
				Success: false,
				Error:   err.Error(),
			})
			continue
		}

		results = append(results, ReplaceResult{
			File:    filePath,
			Success: true,
		})
	}

	return c.JSON(http.StatusOK, results)
}
