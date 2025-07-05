package node

import (
	"embed"
)

//go:embed static/*
var static embed.FS
