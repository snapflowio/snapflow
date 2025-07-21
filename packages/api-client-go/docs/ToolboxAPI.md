# \ToolboxAPI

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateFolder**](ToolboxAPI.md#CreateFolder) | **Post** /toolbox/{sandboxId}/toolbox/files/folder | Create folder
[**CreateSession**](ToolboxAPI.md#CreateSession) | **Post** /toolbox/{sandboxId}/toolbox/process/session | Create session
[**DeleteFile**](ToolboxAPI.md#DeleteFile) | **Delete** /toolbox/{sandboxId}/toolbox/files | Delete file
[**DeleteSession**](ToolboxAPI.md#DeleteSession) | **Delete** /toolbox/{sandboxId}/toolbox/process/session/{sessionId} | Delete session
[**DownloadFile**](ToolboxAPI.md#DownloadFile) | **Get** /toolbox/{sandboxId}/toolbox/files/download | Download file
[**ExecuteCommand**](ToolboxAPI.md#ExecuteCommand) | **Post** /toolbox/{sandboxId}/toolbox/process/execute | Execute command
[**ExecuteSessionCommand**](ToolboxAPI.md#ExecuteSessionCommand) | **Post** /toolbox/{sandboxId}/toolbox/process/session/{sessionId}/exec | Execute command in session
[**FindInFiles**](ToolboxAPI.md#FindInFiles) | **Get** /toolbox/{sandboxId}/toolbox/files/find | Search for text/pattern in files
[**GetFileInfo**](ToolboxAPI.md#GetFileInfo) | **Get** /toolbox/{sandboxId}/toolbox/files/info | Get file info
[**GetProjectDir**](ToolboxAPI.md#GetProjectDir) | **Get** /toolbox/{sandboxId}/toolbox/project-dir | Get sandbox project dir
[**GetSession**](ToolboxAPI.md#GetSession) | **Get** /toolbox/{sandboxId}/toolbox/process/session/{sessionId} | Get session
[**GetSessionCommand**](ToolboxAPI.md#GetSessionCommand) | **Get** /toolbox/{sandboxId}/toolbox/process/session/{sessionId}/command/{commandId} | Get session command
[**GetSessionCommandLogs**](ToolboxAPI.md#GetSessionCommandLogs) | **Get** /toolbox/{sandboxId}/toolbox/process/session/{sessionId}/command/{commandId}/logs | Get command logs
[**GitAddFiles**](ToolboxAPI.md#GitAddFiles) | **Post** /toolbox/{sandboxId}/toolbox/git/add | Add files
[**GitCheckoutBranch**](ToolboxAPI.md#GitCheckoutBranch) | **Post** /toolbox/{sandboxId}/toolbox/git/checkout | Checkout branch
[**GitCloneRepository**](ToolboxAPI.md#GitCloneRepository) | **Post** /toolbox/{sandboxId}/toolbox/git/clone | Clone repository
[**GitCommitChanges**](ToolboxAPI.md#GitCommitChanges) | **Post** /toolbox/{sandboxId}/toolbox/git/commit | Commit changes
[**GitCreateBranch**](ToolboxAPI.md#GitCreateBranch) | **Post** /toolbox/{sandboxId}/toolbox/git/branches | Create branch
[**GitDeleteBranch**](ToolboxAPI.md#GitDeleteBranch) | **Delete** /toolbox/{sandboxId}/toolbox/git/branches | Delete branch
[**GitGetHistory**](ToolboxAPI.md#GitGetHistory) | **Get** /toolbox/{sandboxId}/toolbox/git/history | Get commit history
[**GitGetStatus**](ToolboxAPI.md#GitGetStatus) | **Get** /toolbox/{sandboxId}/toolbox/git/status | Get git status
[**GitListBranches**](ToolboxAPI.md#GitListBranches) | **Get** /toolbox/{sandboxId}/toolbox/git/branches | Get branch list
[**GitPullChanges**](ToolboxAPI.md#GitPullChanges) | **Post** /toolbox/{sandboxId}/toolbox/git/pull | Pull changes
[**GitPushChanges**](ToolboxAPI.md#GitPushChanges) | **Post** /toolbox/{sandboxId}/toolbox/git/push | Push changes
[**ListFiles**](ToolboxAPI.md#ListFiles) | **Get** /toolbox/{sandboxId}/toolbox/files | List files
[**ListSessions**](ToolboxAPI.md#ListSessions) | **Get** /toolbox/{sandboxId}/toolbox/process/session | List sessions
[**LspCompletions**](ToolboxAPI.md#LspCompletions) | **Post** /toolbox/{sandboxId}/toolbox/lsp/completions | Get Lsp Completions
[**LspDidClose**](ToolboxAPI.md#LspDidClose) | **Post** /toolbox/{sandboxId}/toolbox/lsp/did-close | Call Lsp DidClose
[**LspDidOpen**](ToolboxAPI.md#LspDidOpen) | **Post** /toolbox/{sandboxId}/toolbox/lsp/did-open | Call Lsp DidOpen
[**LspDocumentSymbols**](ToolboxAPI.md#LspDocumentSymbols) | **Get** /toolbox/{sandboxId}/toolbox/lsp/document-symbols | Call Lsp DocumentSymbols
[**LspStart**](ToolboxAPI.md#LspStart) | **Post** /toolbox/{sandboxId}/toolbox/lsp/start | Start Lsp server
[**LspStop**](ToolboxAPI.md#LspStop) | **Post** /toolbox/{sandboxId}/toolbox/lsp/stop | Stop Lsp server
[**LspWorkspaceSymbols**](ToolboxAPI.md#LspWorkspaceSymbols) | **Get** /toolbox/{sandboxId}/toolbox/lsp/workspace-symbols | Call Lsp WorkspaceSymbols
[**MoveFile**](ToolboxAPI.md#MoveFile) | **Post** /toolbox/{sandboxId}/toolbox/files/move | Move file
[**ReplaceInFiles**](ToolboxAPI.md#ReplaceInFiles) | **Post** /toolbox/{sandboxId}/toolbox/files/replace | Replace in files
[**SearchFiles**](ToolboxAPI.md#SearchFiles) | **Get** /toolbox/{sandboxId}/toolbox/files/search | Search files
[**SetFilePermissions**](ToolboxAPI.md#SetFilePermissions) | **Post** /toolbox/{sandboxId}/toolbox/files/permissions | Set file permissions
[**UploadFiles**](ToolboxAPI.md#UploadFiles) | **Post** /toolbox/{sandboxId}/toolbox/files/bulk-upload | Upload multiple files



## CreateFolder

> CreateFolder(ctx, sandboxId).Path(path).Mode(mode).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Create folder



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	path := "path_example" // string | 
	mode := "mode_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.CreateFolder(context.Background(), sandboxId).Path(path).Mode(mode).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.CreateFolder``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiCreateFolderRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** |  | 
 **mode** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CreateSession

> CreateSession(ctx, sandboxId).CreateSessionRequest(createSessionRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Create session



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	createSessionRequest := *openapiclient.NewCreateSessionRequest("session-123") // CreateSessionRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.CreateSession(context.Background(), sandboxId).CreateSessionRequest(createSessionRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.CreateSession``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiCreateSessionRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **createSessionRequest** | [**CreateSessionRequest**](CreateSessionRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteFile

> DeleteFile(ctx, sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Delete file



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	path := "path_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.DeleteFile(context.Background(), sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.DeleteFile``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteFileRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteSession

> DeleteSession(ctx, sandboxId, sessionId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Delete session



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	sessionId := "sessionId_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.DeleteSession(context.Background(), sandboxId, sessionId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.DeleteSession``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 
**sessionId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteSessionRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DownloadFile

> *os.File DownloadFile(ctx, sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Download file



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	path := "path_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.DownloadFile(context.Background(), sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.DownloadFile``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DownloadFile`: *os.File
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.DownloadFile`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDownloadFileRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[***os.File**](*os.File.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ExecuteCommand

> ExecuteResponse ExecuteCommand(ctx, sandboxId).ExecuteRequest(executeRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Execute command



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	executeRequest := *openapiclient.NewExecuteRequest("Command_example") // ExecuteRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.ExecuteCommand(context.Background(), sandboxId).ExecuteRequest(executeRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.ExecuteCommand``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExecuteCommand`: ExecuteResponse
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.ExecuteCommand`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiExecuteCommandRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **executeRequest** | [**ExecuteRequest**](ExecuteRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ExecuteResponse**](ExecuteResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ExecuteSessionCommand

> SessionExecuteResponse ExecuteSessionCommand(ctx, sandboxId, sessionId).SessionExecuteRequest(sessionExecuteRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Execute command in session



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	sessionId := "sessionId_example" // string | 
	sessionExecuteRequest := *openapiclient.NewSessionExecuteRequest("ls -la") // SessionExecuteRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.ExecuteSessionCommand(context.Background(), sandboxId, sessionId).SessionExecuteRequest(sessionExecuteRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.ExecuteSessionCommand``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExecuteSessionCommand`: SessionExecuteResponse
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.ExecuteSessionCommand`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 
**sessionId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiExecuteSessionCommandRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


 **sessionExecuteRequest** | [**SessionExecuteRequest**](SessionExecuteRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**SessionExecuteResponse**](SessionExecuteResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## FindInFiles

> []Match FindInFiles(ctx, sandboxId).Path(path).Pattern(pattern).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Search for text/pattern in files



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	path := "path_example" // string | 
	pattern := "pattern_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.FindInFiles(context.Background(), sandboxId).Path(path).Pattern(pattern).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.FindInFiles``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `FindInFiles`: []Match
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.FindInFiles`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiFindInFilesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** |  | 
 **pattern** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**[]Match**](Match.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetFileInfo

> FileInfo GetFileInfo(ctx, sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get file info



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	path := "path_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.GetFileInfo(context.Background(), sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GetFileInfo``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetFileInfo`: FileInfo
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.GetFileInfo`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetFileInfoRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**FileInfo**](FileInfo.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetProjectDir

> ProjectDirResponse GetProjectDir(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get sandbox project dir

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.GetProjectDir(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GetProjectDir``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetProjectDir`: ProjectDirResponse
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.GetProjectDir`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetProjectDirRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ProjectDirResponse**](ProjectDirResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetSession

> Session GetSession(ctx, sandboxId, sessionId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get session



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	sessionId := "sessionId_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.GetSession(context.Background(), sandboxId, sessionId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GetSession``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetSession`: Session
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.GetSession`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 
**sessionId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetSessionRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**Session**](Session.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetSessionCommand

> Command GetSessionCommand(ctx, sandboxId, sessionId, commandId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get session command



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	sessionId := "sessionId_example" // string | 
	commandId := "commandId_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.GetSessionCommand(context.Background(), sandboxId, sessionId, commandId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GetSessionCommand``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetSessionCommand`: Command
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.GetSessionCommand`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 
**sessionId** | **string** |  | 
**commandId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetSessionCommandRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------



 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**Command**](Command.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GetSessionCommandLogs

> string GetSessionCommandLogs(ctx, sandboxId, sessionId, commandId).XSnapflowOrganizationID(xSnapflowOrganizationID).Follow(follow).Execute()

Get command logs



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	sessionId := "sessionId_example" // string | 
	commandId := "commandId_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)
	follow := true // bool |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.GetSessionCommandLogs(context.Background(), sandboxId, sessionId, commandId).XSnapflowOrganizationID(xSnapflowOrganizationID).Follow(follow).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GetSessionCommandLogs``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetSessionCommandLogs`: string
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.GetSessionCommandLogs`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 
**sessionId** | **string** |  | 
**commandId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetSessionCommandLogsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------



 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 
 **follow** | **bool** |  | 

### Return type

**string**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitAddFiles

> GitAddFiles(ctx, sandboxId).GitAddRequest(gitAddRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Add files



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	gitAddRequest := *openapiclient.NewGitAddRequest("Path_example", []string{"Files_example"}) // GitAddRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.GitAddFiles(context.Background(), sandboxId).GitAddRequest(gitAddRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitAddFiles``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitAddFilesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **gitAddRequest** | [**GitAddRequest**](GitAddRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitCheckoutBranch

> GitCheckoutBranch(ctx, sandboxId).GitCheckoutRequest(gitCheckoutRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Checkout branch



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	gitCheckoutRequest := *openapiclient.NewGitCheckoutRequest("Path_example", "Branch_example") // GitCheckoutRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.GitCheckoutBranch(context.Background(), sandboxId).GitCheckoutRequest(gitCheckoutRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitCheckoutBranch``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitCheckoutBranchRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **gitCheckoutRequest** | [**GitCheckoutRequest**](GitCheckoutRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitCloneRepository

> GitCloneRepository(ctx, sandboxId).GitCloneRequest(gitCloneRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Clone repository



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	gitCloneRequest := *openapiclient.NewGitCloneRequest("Url_example", "Path_example") // GitCloneRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.GitCloneRepository(context.Background(), sandboxId).GitCloneRequest(gitCloneRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitCloneRepository``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitCloneRepositoryRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **gitCloneRequest** | [**GitCloneRequest**](GitCloneRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitCommitChanges

> GitCommitResponse GitCommitChanges(ctx, sandboxId).GitCommitRequest(gitCommitRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Commit changes



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	gitCommitRequest := *openapiclient.NewGitCommitRequest("Path_example", "Message_example", "Author_example", "Email_example") // GitCommitRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.GitCommitChanges(context.Background(), sandboxId).GitCommitRequest(gitCommitRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitCommitChanges``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GitCommitChanges`: GitCommitResponse
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.GitCommitChanges`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitCommitChangesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **gitCommitRequest** | [**GitCommitRequest**](GitCommitRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**GitCommitResponse**](GitCommitResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitCreateBranch

> GitCreateBranch(ctx, sandboxId).GitBranchRequest(gitBranchRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Create branch



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	gitBranchRequest := *openapiclient.NewGitBranchRequest("Path_example", "Name_example") // GitBranchRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.GitCreateBranch(context.Background(), sandboxId).GitBranchRequest(gitBranchRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitCreateBranch``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitCreateBranchRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **gitBranchRequest** | [**GitBranchRequest**](GitBranchRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitDeleteBranch

> GitDeleteBranch(ctx, sandboxId).GitDeleteBranchRequest(gitDeleteBranchRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Delete branch



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	gitDeleteBranchRequest := *openapiclient.NewGitDeleteBranchRequest("Path_example", "Name_example") // GitDeleteBranchRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.GitDeleteBranch(context.Background(), sandboxId).GitDeleteBranchRequest(gitDeleteBranchRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitDeleteBranch``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitDeleteBranchRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **gitDeleteBranchRequest** | [**GitDeleteBranchRequest**](GitDeleteBranchRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitGetHistory

> []GitCommitInfo GitGetHistory(ctx, sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get commit history



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	path := "path_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.GitGetHistory(context.Background(), sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitGetHistory``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GitGetHistory`: []GitCommitInfo
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.GitGetHistory`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitGetHistoryRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**[]GitCommitInfo**](GitCommitInfo.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitGetStatus

> GitStatus GitGetStatus(ctx, sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get git status



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	path := "path_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.GitGetStatus(context.Background(), sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitGetStatus``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GitGetStatus`: GitStatus
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.GitGetStatus`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitGetStatusRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**GitStatus**](GitStatus.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitListBranches

> ListBranchResponse GitListBranches(ctx, sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get branch list



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	path := "path_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.GitListBranches(context.Background(), sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitListBranches``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GitListBranches`: ListBranchResponse
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.GitListBranches`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitListBranchesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**ListBranchResponse**](ListBranchResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitPullChanges

> GitPullChanges(ctx, sandboxId).GitRepoRequest(gitRepoRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Pull changes



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	gitRepoRequest := *openapiclient.NewGitRepoRequest("Path_example") // GitRepoRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.GitPullChanges(context.Background(), sandboxId).GitRepoRequest(gitRepoRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitPullChanges``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitPullChangesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **gitRepoRequest** | [**GitRepoRequest**](GitRepoRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## GitPushChanges

> GitPushChanges(ctx, sandboxId).GitRepoRequest(gitRepoRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Push changes



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	gitRepoRequest := *openapiclient.NewGitRepoRequest("Path_example") // GitRepoRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.GitPushChanges(context.Background(), sandboxId).GitRepoRequest(gitRepoRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.GitPushChanges``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGitPushChangesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **gitRepoRequest** | [**GitRepoRequest**](GitRepoRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListFiles

> []FileInfo ListFiles(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Path(path).Execute()

List files

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)
	path := "path_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.ListFiles(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Path(path).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.ListFiles``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListFiles`: []FileInfo
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.ListFiles`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListFilesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 
 **path** | **string** |  | 

### Return type

[**[]FileInfo**](FileInfo.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListSessions

> []Session ListSessions(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

List sessions



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.ListSessions(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.ListSessions``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListSessions`: []Session
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.ListSessions`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiListSessionsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**[]Session**](Session.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## LspCompletions

> CompletionList LspCompletions(ctx, sandboxId).LspCompletionParams(lspCompletionParams).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Get Lsp Completions



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	lspCompletionParams := *openapiclient.NewLspCompletionParams("LanguageId_example", "PathToProject_example", "Uri_example", *openapiclient.NewPosition(float32(123), float32(123))) // LspCompletionParams | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.LspCompletions(context.Background(), sandboxId).LspCompletionParams(lspCompletionParams).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.LspCompletions``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LspCompletions`: CompletionList
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.LspCompletions`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLspCompletionsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **lspCompletionParams** | [**LspCompletionParams**](LspCompletionParams.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**CompletionList**](CompletionList.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## LspDidClose

> LspDidClose(ctx, sandboxId).LspDocumentRequest(lspDocumentRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Call Lsp DidClose



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	lspDocumentRequest := *openapiclient.NewLspDocumentRequest("LanguageId_example", "PathToProject_example", "Uri_example") // LspDocumentRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.LspDidClose(context.Background(), sandboxId).LspDocumentRequest(lspDocumentRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.LspDidClose``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLspDidCloseRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **lspDocumentRequest** | [**LspDocumentRequest**](LspDocumentRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## LspDidOpen

> LspDidOpen(ctx, sandboxId).LspDocumentRequest(lspDocumentRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Call Lsp DidOpen



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	lspDocumentRequest := *openapiclient.NewLspDocumentRequest("LanguageId_example", "PathToProject_example", "Uri_example") // LspDocumentRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.LspDidOpen(context.Background(), sandboxId).LspDocumentRequest(lspDocumentRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.LspDidOpen``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLspDidOpenRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **lspDocumentRequest** | [**LspDocumentRequest**](LspDocumentRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## LspDocumentSymbols

> []LspSymbol LspDocumentSymbols(ctx, sandboxId).LanguageId(languageId).PathToProject(pathToProject).Uri(uri).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Call Lsp DocumentSymbols



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	languageId := "languageId_example" // string | 
	pathToProject := "pathToProject_example" // string | 
	uri := "uri_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.LspDocumentSymbols(context.Background(), sandboxId).LanguageId(languageId).PathToProject(pathToProject).Uri(uri).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.LspDocumentSymbols``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LspDocumentSymbols`: []LspSymbol
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.LspDocumentSymbols`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLspDocumentSymbolsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **languageId** | **string** |  | 
 **pathToProject** | **string** |  | 
 **uri** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**[]LspSymbol**](LspSymbol.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## LspStart

> LspStart(ctx, sandboxId).LspServerRequest(lspServerRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Start Lsp server



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	lspServerRequest := *openapiclient.NewLspServerRequest("LanguageId_example", "PathToProject_example") // LspServerRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.LspStart(context.Background(), sandboxId).LspServerRequest(lspServerRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.LspStart``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLspStartRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **lspServerRequest** | [**LspServerRequest**](LspServerRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## LspStop

> LspStop(ctx, sandboxId).LspServerRequest(lspServerRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Stop Lsp server



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	lspServerRequest := *openapiclient.NewLspServerRequest("LanguageId_example", "PathToProject_example") // LspServerRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.LspStop(context.Background(), sandboxId).LspServerRequest(lspServerRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.LspStop``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLspStopRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **lspServerRequest** | [**LspServerRequest**](LspServerRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## LspWorkspaceSymbols

> []LspSymbol LspWorkspaceSymbols(ctx, sandboxId).LanguageId(languageId).PathToProject(pathToProject).Query(query).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Call Lsp WorkspaceSymbols



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	languageId := "languageId_example" // string | 
	pathToProject := "pathToProject_example" // string | 
	query := "query_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.LspWorkspaceSymbols(context.Background(), sandboxId).LanguageId(languageId).PathToProject(pathToProject).Query(query).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.LspWorkspaceSymbols``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `LspWorkspaceSymbols`: []LspSymbol
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.LspWorkspaceSymbols`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiLspWorkspaceSymbolsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **languageId** | **string** |  | 
 **pathToProject** | **string** |  | 
 **query** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**[]LspSymbol**](LspSymbol.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## MoveFile

> MoveFile(ctx, sandboxId).Source(source).Destination(destination).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Move file



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	source := "source_example" // string | 
	destination := "destination_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.MoveFile(context.Background(), sandboxId).Source(source).Destination(destination).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.MoveFile``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiMoveFileRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **source** | **string** |  | 
 **destination** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ReplaceInFiles

> []ReplaceResult ReplaceInFiles(ctx, sandboxId).ReplaceRequest(replaceRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Replace in files



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	replaceRequest := *openapiclient.NewReplaceRequest([]string{"Files_example"}, "Pattern_example", "NewValue_example") // ReplaceRequest | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.ReplaceInFiles(context.Background(), sandboxId).ReplaceRequest(replaceRequest).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.ReplaceInFiles``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ReplaceInFiles`: []ReplaceResult
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.ReplaceInFiles`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiReplaceInFilesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **replaceRequest** | [**ReplaceRequest**](ReplaceRequest.md) |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**[]ReplaceResult**](ReplaceResult.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SearchFiles

> SearchFilesResponse SearchFiles(ctx, sandboxId).Path(path).Pattern(pattern).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Search files



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	path := "path_example" // string | 
	pattern := "pattern_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ToolboxAPI.SearchFiles(context.Background(), sandboxId).Path(path).Pattern(pattern).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.SearchFiles``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SearchFiles`: SearchFilesResponse
	fmt.Fprintf(os.Stdout, "Response from `ToolboxAPI.SearchFiles`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiSearchFilesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** |  | 
 **pattern** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

[**SearchFilesResponse**](SearchFilesResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SetFilePermissions

> SetFilePermissions(ctx, sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Owner(owner).Group(group).Mode(mode).Execute()

Set file permissions



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	path := "path_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)
	owner := "owner_example" // string |  (optional)
	group := "group_example" // string |  (optional)
	mode := "mode_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.SetFilePermissions(context.Background(), sandboxId).Path(path).XSnapflowOrganizationID(xSnapflowOrganizationID).Owner(owner).Group(group).Mode(mode).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.SetFilePermissions``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiSetFilePermissionsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **path** | **string** |  | 
 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 
 **owner** | **string** |  | 
 **group** | **string** |  | 
 **mode** | **string** |  | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UploadFiles

> UploadFiles(ctx, sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()

Upload multiple files



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	sandboxId := "sandboxId_example" // string | 
	xSnapflowOrganizationID := "xSnapflowOrganizationID_example" // string | Use with JWT to specify the organization ID (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	r, err := apiClient.ToolboxAPI.UploadFiles(context.Background(), sandboxId).XSnapflowOrganizationID(xSnapflowOrganizationID).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ToolboxAPI.UploadFiles``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**sandboxId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiUploadFilesRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **xSnapflowOrganizationID** | **string** | Use with JWT to specify the organization ID | 

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

