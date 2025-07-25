package session

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/snapflow/node/pkg/common"
)

var sessions = map[string]*session{}

func (s *SessionController) CreateSession(c echo.Context) error {
	ctx, cancel := context.WithCancel(context.Background())

	cmd := exec.CommandContext(ctx, common.GetShell())
	cmd.Env = os.Environ()
	cmd.Dir = s.projectDir

	var request CreateSessionRequest
	if err := c.Bind(&request); err != nil {
		cancel()
		return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
	}

	if _, ok := sessions[request.SessionId]; ok {
		cancel()
		return echo.NewHTTPError(http.StatusConflict, "session already exists")
	}

	stdinWriter, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	err = cmd.Start()
	if err != nil {
		cancel()
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	session := &session{
		id:          request.SessionId,
		cmd:         cmd,
		stdinWriter: stdinWriter,
		commands:    map[string]*Command{},
		ctx:         ctx,
		cancel:      cancel,
	}
	sessions[request.SessionId] = session

	err = os.MkdirAll(session.Dir(s.configDir), 0755)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.NoContent(http.StatusCreated)
}

func (s *SessionController) DeleteSession(c echo.Context) error {
	sessionId := c.Param("sessionId")

	session, ok := sessions[sessionId]
	if !ok || session.deleted {
		return echo.NewHTTPError(http.StatusNotFound, "session not found")
	}

	session.cancel()
	session.deleted = true

	err := os.RemoveAll(session.Dir(s.configDir))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

func (s *SessionController) ListSessions(c echo.Context) error {
	sessionDTOs := []Session{}

	for sessionId, session := range sessions {
		if session.deleted {
			continue
		}

		commands, err := s.getSessionCommands(sessionId)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}

		sessionDTOs = append(sessionDTOs, Session{
			SessionId: sessionId,
			Commands:  commands,
		})
	}

	return c.JSON(http.StatusOK, sessionDTOs)
}

func (s *SessionController) GetSession(c echo.Context) error {
	sessionId := c.Param("sessionId")

	session, ok := sessions[sessionId]
	if !ok || session.deleted {
		return echo.NewHTTPError(http.StatusNotFound, "session not found")
	}

	commands, err := s.getSessionCommands(sessionId)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, Session{
		SessionId: sessionId,
		Commands:  commands,
	})
}

func (s *SessionController) GetSessionCommand(c echo.Context) error {
	sessionId := c.Param("sessionId")
	cmdId := c.Param("commandId")

	command, err := s.getSessionCommand(sessionId, cmdId)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	}

	return c.JSON(http.StatusOK, command)
}

func (s *SessionController) getSessionCommands(sessionId string) ([]*Command, error) {
	session, ok := sessions[sessionId]
	if !ok || session.deleted {
		return nil, errors.New("session not found")
	}

	commands := []*Command{}
	for _, command := range session.commands {
		cmd, err := s.getSessionCommand(sessionId, command.Id)
		if err != nil {
			return nil, err
		}
		commands = append(commands, cmd)
	}

	return commands, nil
}

func (s *SessionController) getSessionCommand(sessionId, cmdId string) (*Command, error) {
	session, ok := sessions[sessionId]
	if !ok || session.deleted {
		return nil, errors.New("session not found")
	}

	command, ok := session.commands[cmdId]
	if !ok {
		return nil, errors.New("command not found")
	}

	if command.ExitCode != nil {
		return command, nil
	}

	_, exitCodeFilePath := command.LogFilePath(session.Dir(s.configDir))
	exitCode, err := os.ReadFile(exitCodeFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return command, nil
		}
		return nil, errors.New("failed to read exit code file")
	}

	exitCodeInt, err := strconv.Atoi(strings.TrimRight(string(exitCode), "\n"))
	if err != nil {
		return nil, errors.New("failed to convert exit code to int")
	}

	command.ExitCode = &exitCodeInt

	return command, nil
}
