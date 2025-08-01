package models

import (
	"time"

	"github.com/snapflowio/executor/pkg/models/enums"
)

type CacheData struct {
	SandboxState    enums.SandboxState
	BackupState     enums.BackupState
	DestructionTime *time.Time
}
