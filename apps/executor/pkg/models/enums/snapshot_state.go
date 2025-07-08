package enums

type BackupState string

const (
	BackupStateNone       BackupState = "NONE"
	BackupStatePending    BackupState = "PENDING"
	BackupStateInProgress BackupState = "IN_PROGRESS"
	BackupStateCompleted  BackupState = "COMPLETED"
	BackupStateFailed     BackupState = "FAILED"
)

func (s BackupState) String() string {
	return string(s)
}
