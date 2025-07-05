package session

type SessionController struct {
	configDir  string
	projectDir string
}

func NewSessionController(configDir, projectDir string) *SessionController {
	return &SessionController{
		configDir:  configDir,
		projectDir: projectDir,
	}
}
