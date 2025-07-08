package storage

import (
	"context"
)

type ObjectStorageClient interface {
	GetObject(ctx context.Context, organizationId, hash string) ([]byte, error)
}
