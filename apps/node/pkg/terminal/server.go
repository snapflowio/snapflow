package terminal

import (
	"encoding/json"
	"fmt"
	"github.com/rs/zerolog/log"
	"io"
	"io/fs"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/snapflowio/node/pkg/common"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type windowSize struct {
	Rows uint16 `json:"rows"`
	Cols uint16 `json:"cols"`
}

func StartTerminalServer(port int) error {
	staticFS, err := fs.Sub(static, "static")
	if err != nil {
		return err
	}

	http.Handle("/", http.FileServer(http.FS(staticFS)))
	http.HandleFunc("/ws", handleWebSocket)

	addr := fmt.Sprintf(":%d", port)
	log.Info().Msgf("Starting terminal server on http://localhost%s", addr)
	return http.ListenAndServe(addr, nil)
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Msgf("Failed to upgrade connection: %v", err)
		return
	}

	defer conn.Close()

	sizeCh := make(chan common.TTYSize)
	stdInReader, stdInWriter := io.Pipe()
	stdOutReader, stdOutWriter := io.Pipe()

	go func() {
		for {
			messageType, p, err := conn.ReadMessage()
			if err != nil {
				return
			}

			if messageType == websocket.TextMessage {
				var size windowSize
				if err := json.Unmarshal(p, &size); err == nil {
					sizeCh <- common.TTYSize{
						Height: int(size.Rows),
						Width:  int(size.Cols),
					}
					continue
				}
			}

			_, err = stdInWriter.Write(p)
			if err != nil {
				return
			}
		}
	}()

	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := stdOutReader.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Error().Msgf("Failed to read from pty: %v", err)
				}
				return
			}

			err = conn.WriteMessage(websocket.TextMessage, buf[:n])
			if err != nil {
				log.Error().Msgf("Failed to write to websocket: %v", err)
				return
			}
		}
	}()

	err = common.SpawnTTY(common.SpawnTTYOptions{
		Dir:    "/",
		StdIn:  stdInReader,
		StdOut: stdOutWriter,
		Term:   "xterm-256color",
		SizeCh: sizeCh,
	})

	if err != nil {
		log.Error().Msgf("Failed to start pty: %v", err)
		return
	}
}
