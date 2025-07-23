package node

import (
	"os"
	"path/filepath"
)

func WriteNodeBinary() (string, error) {
	nodeBinary, err := static.ReadFile("static/node-amd64")
	if err != nil {
		return "", err
	}

	pwd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	tmpBinariesDir := filepath.Join(pwd, ".tmp", "binaries")
	err = os.MkdirAll(tmpBinariesDir, 0755)
	if err != nil {
		return "", err
	}

	nodePath := filepath.Join(tmpBinariesDir, "node-amd64")
	_, err = os.Stat(nodePath)
	if err != nil && !os.IsNotExist(err) {
		return "", err
	}

	if err == nil {
		err = os.Remove(nodePath)
		if err != nil {
			return "", err
		}
	}

	err = os.WriteFile(nodePath, nodeBinary, 0755)
	if err != nil {
		return "", err
	}

	return nodePath, nil
}
