package session

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/snapflow/node/internal/util"

	log "github.com/sirupsen/logrus"
)

func (s *SessionController) GetSessionCommandLogs(c echo.Context) error {
	sessionId := c.Param("sessionId")
	cmdId := c.Param("commandId")

	session, ok := sessions[sessionId]
	if !ok || session.deleted {
		return echo.NewHTTPError(http.StatusNotFound, "session not found")
	}

	command, ok := sessions[sessionId].commands[cmdId]
	if !ok {
		return echo.NewHTTPError(http.StatusNotFound, "command not found")
	}

	logFilePath, _ := command.LogFilePath(session.Dir(s.configDir))

	if c.Request().Header.Get("Upgrade") == "websocket" {
		logFile, err := os.Open(logFilePath)
		if err != nil {
			if os.IsNotExist(err) {
				return echo.NewHTTPError(http.StatusNotFound, err.Error())
			}
			if os.IsPermission(err) {
				return echo.NewHTTPError(http.StatusForbidden, err.Error())
			}
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}
		defer logFile.Close()

		ReadLog(c, logFile, util.ReadLog, func(conn *websocket.Conn, messages chan []byte, errors chan error) {
			for {
				select {
				case <-session.ctx.Done():
					err := conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(time.Second))
					if err != nil {
						log.Error(err)
					}
					conn.Close()
					return
				case msg := <-messages:
					err := conn.WriteMessage(websocket.TextMessage, msg)
					if err != nil {
						errors <- err
						return
					}
				}
			}
		})
		return nil
	}

	logBytes, err := os.ReadFile(logFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return echo.NewHTTPError(http.StatusNotFound, err.Error())
		}
		if os.IsPermission(err) {
			return echo.NewHTTPError(http.StatusForbidden, err.Error())
		}
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.String(http.StatusOK, string(logBytes))
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func ReadLog[T any](echoCtx echo.Context, logReader io.Reader, readFunc func(context.Context, io.Reader, bool, chan T, chan error), wsWriteFunc func(*websocket.Conn, chan T, chan error)) error {
	followQuery := echoCtx.QueryParam("follow")
	follow := followQuery == "true"

	ws, err := upgrader.Upgrade(echoCtx.Response(), echoCtx.Request(), nil)
	if err != nil {
		log.Error(err)
		return err
	}

	defer func() {
		closeErr := websocket.CloseNormalClosure
		if !errors.Is(err, io.EOF) {
			closeErr = websocket.CloseInternalServerErr
		}
		err := ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(closeErr, ""), time.Now().Add(time.Second))
		if err != nil {
			log.Trace(err)
		}
		ws.Close()
	}()

	msgChannel := make(chan T)
	errChannel := make(chan error)
	ctx, cancel := context.WithCancel(echoCtx.Request().Context())

	defer cancel()
	go readFunc(ctx, logReader, follow, msgChannel, errChannel)
	go wsWriteFunc(ws, msgChannel, errChannel)

	readErr := make(chan error)
	go func() {
		for {
			_, _, err := ws.ReadMessage()
			readErr <- err
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return nil
		case err = <-errChannel:
			if err != nil {
				if !errors.Is(err, io.EOF) {
					log.Error(err)
				}
				cancel()
				return nil
			}
		case err := <-readErr:
			if websocket.IsUnexpectedCloseError(err, websocket.CloseNormalClosure, websocket.CloseAbnormalClosure) {
				log.Error(err)
			}
			if err != nil {
				return nil
			}
		}
	}
}
