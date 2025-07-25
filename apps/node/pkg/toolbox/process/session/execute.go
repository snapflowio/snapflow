package session

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/snapflow/node/internal/util"
)

type ErrorResponse struct {
	Error string `json:"error"`
}

func (s *SessionController) SessionExecuteCommand(c echo.Context) error {
	sessionId := c.Param("sessionId")

	var request SessionExecuteRequest
	if err := c.Bind(&request); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	if request.Async {
		request.RunAsync = true
	}

	// Validate command is not empty (if not already handled by binding)
	if strings.TrimSpace(request.Command) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "command cannot be empty")
	}

	session, ok := sessions[sessionId]
	if !ok {
		return echo.NewHTTPError(http.StatusNotFound, "session not found")
	}

	var cmdId *string
	var logFile *os.File

	cmdId = util.Pointer(uuid.NewString())

	command := &Command{
		Id:      *cmdId,
		Command: request.Command,
	}
	session.commands[*cmdId] = command

	logFilePath, exitCodeFilePath := command.LogFilePath(session.Dir(s.configDir))

	if err := os.MkdirAll(filepath.Dir(logFilePath), 0755); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("failed to create log directory: %v", err))
	}

	logFile, err := os.Create(logFilePath)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("failed to create log file: %v", err))
	}

	defer logFile.Close()

	cmdToExec := fmt.Sprintf("{ %s; } > %s 2>&1 ; echo \"$?\" > %s\n", request.Command, logFile.Name(), exitCodeFilePath)

	_, err = session.stdinWriter.Write([]byte(cmdToExec))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("failed to write command: %v", err))
	}

	if request.RunAsync {
		return c.JSON(http.StatusAccepted, SessionExecuteResponse{
			CommandId: cmdId,
		})
	}

	for {
		select {
		case <-session.ctx.Done():
			session.commands[*cmdId].ExitCode = util.Pointer(1)
			return echo.NewHTTPError(http.StatusBadRequest, "session cancelled")
		default:
			exitCode, err := os.ReadFile(exitCodeFilePath)
			if err != nil {
				if os.IsNotExist(err) {
					time.Sleep(50 * time.Millisecond)
					continue
				}
				return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("failed to read exit code file: %v", err))
			}

			exitCodeInt, err := strconv.Atoi(strings.TrimRight(string(exitCode), "\n"))
			if err != nil {
				return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("failed to convert exit code to int: %v", err))
			}

			sessions[sessionId].commands[*cmdId].ExitCode = &exitCodeInt

			logBytes, err := os.ReadFile(logFilePath)
			if err != nil {
				return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("failed to read log file: %v", err))
			}

			logContent := string(logBytes)

			return c.JSON(http.StatusOK, SessionExecuteResponse{
				CommandId: cmdId,
				Output:    &logContent,
				ExitCode:  &exitCodeInt,
			})
		}
	}
}
