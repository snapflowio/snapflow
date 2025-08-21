package process

import (
	"bytes"
	"net/http"
	"os/exec"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog/log"
)

func ExecuteCommand(c echo.Context) error {
	var request ExecuteRequest
	if err := c.Bind(&request); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "command is required")
	}

	cmdParts := parseCommand(request.Command)
	if len(cmdParts) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "empty command")
	}

	cmd := exec.Command(cmdParts[0], cmdParts[1:]...)
	if request.Cwd != nil {
		cmd.Dir = *request.Cwd
	}

	// set maximum execution time
	timeout := 120 * time.Second // 2 minutes default
	if request.Timeout != nil && *request.Timeout > 0 {
		timeout = time.Duration(*request.Timeout) * time.Second
	}

	timeoutReached := false
	timer := time.AfterFunc(timeout, func() {
		timeoutReached = true
		if cmd.Process != nil {
			// kill the process group
			err := cmd.Process.Kill()
			if err != nil {
				log.Error().Msg(err.Error())
				return
			}
		}
	})

	defer timer.Stop()

	output, err := cmd.CombinedOutput()
	if err != nil {
		if timeoutReached {
			return echo.NewHTTPError(http.StatusRequestTimeout, "command execution timeout")
		}
		if exitError, ok := err.(*exec.ExitError); ok {
			return c.JSON(http.StatusOK, ExecuteResponse{
				Code:   exitError.ExitCode(),
				Result: string(output),
			})
		}
		return c.JSON(http.StatusOK, ExecuteResponse{
			Code:   -1,
			Result: string(output),
		})
	}

	if cmd.ProcessState == nil {
		return c.JSON(http.StatusOK, ExecuteResponse{
			Code:   -1,
			Result: string(output),
		})
	}

	return c.JSON(http.StatusOK, ExecuteResponse{
		Code:   cmd.ProcessState.ExitCode(),
		Result: string(output),
	})
}

func parseCommand(command string) []string {
	var args []string
	var current bytes.Buffer
	var inQuotes bool
	var quoteChar rune

	for _, r := range command {
		switch {
		case r == '"' || r == '\'':
			if !inQuotes {
				inQuotes = true
				quoteChar = r
			} else if quoteChar == r {
				inQuotes = false
				quoteChar = 0
			} else {
				current.WriteRune(r)
			}
		case r == ' ' && !inQuotes:
			if current.Len() > 0 {
				args = append(args, current.String())
				current.Reset()
			}
		default:
			current.WriteRune(r)
		}
	}

	if current.Len() > 0 {
		args = append(args, current.String())
	}

	return args
}
