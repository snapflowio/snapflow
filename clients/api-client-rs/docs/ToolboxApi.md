# \ToolboxApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**click_mouse**](ToolboxApi.md#click_mouse) | **POST** /toolbox/{sandboxId}/toolbox/computer/mouse/click | Click mouse
[**create_folder**](ToolboxApi.md#create_folder) | **POST** /toolbox/{sandboxId}/toolbox/files/folder | Create folder
[**create_session**](ToolboxApi.md#create_session) | **POST** /toolbox/{sandboxId}/toolbox/process/session | Create session
[**delete_file**](ToolboxApi.md#delete_file) | **DELETE** /toolbox/{sandboxId}/toolbox/files | Delete file
[**delete_session**](ToolboxApi.md#delete_session) | **DELETE** /toolbox/{sandboxId}/toolbox/process/session/{sessionId} | Delete session
[**download_file**](ToolboxApi.md#download_file) | **GET** /toolbox/{sandboxId}/toolbox/files/download | Download file
[**drag_mouse**](ToolboxApi.md#drag_mouse) | **POST** /toolbox/{sandboxId}/toolbox/computer/mouse/drag | Drag mouse
[**execute_command**](ToolboxApi.md#execute_command) | **POST** /toolbox/{sandboxId}/toolbox/process/execute | Execute command
[**execute_session_command**](ToolboxApi.md#execute_session_command) | **POST** /toolbox/{sandboxId}/toolbox/process/session/{sessionId}/exec | Execute command in session
[**find_in_files**](ToolboxApi.md#find_in_files) | **GET** /toolbox/{sandboxId}/toolbox/files/find | Search for text/pattern in files
[**get_computer_status**](ToolboxApi.md#get_computer_status) | **GET** /toolbox/{sandboxId}/toolbox/computer/status | Get computer status
[**get_display_info**](ToolboxApi.md#get_display_info) | **GET** /toolbox/{sandboxId}/toolbox/computer/display/info | Get display info
[**get_file_info**](ToolboxApi.md#get_file_info) | **GET** /toolbox/{sandboxId}/toolbox/files/info | Get file info
[**get_mouse_position**](ToolboxApi.md#get_mouse_position) | **GET** /toolbox/{sandboxId}/toolbox/computer/mouse/position | Get mouse position
[**get_process_errors**](ToolboxApi.md#get_process_errors) | **GET** /toolbox/{sandboxId}/toolbox/computer/process/{processName}/errors | Get process errors
[**get_process_logs**](ToolboxApi.md#get_process_logs) | **GET** /toolbox/{sandboxId}/toolbox/computer/process/{processName}/logs | Get process logs
[**get_process_status**](ToolboxApi.md#get_process_status) | **GET** /toolbox/{sandboxId}/toolbox/computer/process/{processName}/status | Get process status
[**get_project_dir**](ToolboxApi.md#get_project_dir) | **GET** /toolbox/{sandboxId}/toolbox/project-dir | Get sandbox project dir
[**get_session**](ToolboxApi.md#get_session) | **GET** /toolbox/{sandboxId}/toolbox/process/session/{sessionId} | Get session
[**get_session_command**](ToolboxApi.md#get_session_command) | **GET** /toolbox/{sandboxId}/toolbox/process/session/{sessionId}/command/{commandId} | Get session command
[**get_session_command_logs**](ToolboxApi.md#get_session_command_logs) | **GET** /toolbox/{sandboxId}/toolbox/process/session/{sessionId}/command/{commandId}/logs | Get command logs
[**get_windows**](ToolboxApi.md#get_windows) | **GET** /toolbox/{sandboxId}/toolbox/computer/display/windows | Get windows
[**git_add_files**](ToolboxApi.md#git_add_files) | **POST** /toolbox/{sandboxId}/toolbox/git/add | Add files
[**git_checkout_branch**](ToolboxApi.md#git_checkout_branch) | **POST** /toolbox/{sandboxId}/toolbox/git/checkout | Checkout branch
[**git_clone_repository**](ToolboxApi.md#git_clone_repository) | **POST** /toolbox/{sandboxId}/toolbox/git/clone | Clone repository
[**git_commit_changes**](ToolboxApi.md#git_commit_changes) | **POST** /toolbox/{sandboxId}/toolbox/git/commit | Commit changes
[**git_create_branch**](ToolboxApi.md#git_create_branch) | **POST** /toolbox/{sandboxId}/toolbox/git/branches | Create branch
[**git_delete_branch**](ToolboxApi.md#git_delete_branch) | **DELETE** /toolbox/{sandboxId}/toolbox/git/branches | Delete branch
[**git_get_history**](ToolboxApi.md#git_get_history) | **GET** /toolbox/{sandboxId}/toolbox/git/history | Get commit history
[**git_get_status**](ToolboxApi.md#git_get_status) | **GET** /toolbox/{sandboxId}/toolbox/git/status | Get git status
[**git_list_branches**](ToolboxApi.md#git_list_branches) | **GET** /toolbox/{sandboxId}/toolbox/git/branches | Get branch list
[**git_pull_changes**](ToolboxApi.md#git_pull_changes) | **POST** /toolbox/{sandboxId}/toolbox/git/pull | Pull changes
[**git_push_changes**](ToolboxApi.md#git_push_changes) | **POST** /toolbox/{sandboxId}/toolbox/git/push | Push changes
[**list_files**](ToolboxApi.md#list_files) | **GET** /toolbox/{sandboxId}/toolbox/files | List files
[**list_sessions**](ToolboxApi.md#list_sessions) | **GET** /toolbox/{sandboxId}/toolbox/process/session | List sessions
[**lsp_completions**](ToolboxApi.md#lsp_completions) | **POST** /toolbox/{sandboxId}/toolbox/lsp/completions | Get Lsp Completions
[**lsp_did_close**](ToolboxApi.md#lsp_did_close) | **POST** /toolbox/{sandboxId}/toolbox/lsp/did-close | Call Lsp DidClose
[**lsp_did_open**](ToolboxApi.md#lsp_did_open) | **POST** /toolbox/{sandboxId}/toolbox/lsp/did-open | Call Lsp DidOpen
[**lsp_document_symbols**](ToolboxApi.md#lsp_document_symbols) | **GET** /toolbox/{sandboxId}/toolbox/lsp/document-symbols | Call Lsp DocumentSymbols
[**lsp_start**](ToolboxApi.md#lsp_start) | **POST** /toolbox/{sandboxId}/toolbox/lsp/start | Start Lsp server
[**lsp_stop**](ToolboxApi.md#lsp_stop) | **POST** /toolbox/{sandboxId}/toolbox/lsp/stop | Stop Lsp server
[**lsp_workspace_symbols**](ToolboxApi.md#lsp_workspace_symbols) | **GET** /toolbox/{sandboxId}/toolbox/lsp/workspace-symbols | Call Lsp WorkspaceSymbols
[**move_file**](ToolboxApi.md#move_file) | **POST** /toolbox/{sandboxId}/toolbox/files/move | Move file
[**move_mouse**](ToolboxApi.md#move_mouse) | **POST** /toolbox/{sandboxId}/toolbox/computer/mouse/move | Move mouse
[**press_hotkey**](ToolboxApi.md#press_hotkey) | **POST** /toolbox/{sandboxId}/toolbox/computer/keyboard/hotkey | Press hotkey
[**press_key**](ToolboxApi.md#press_key) | **POST** /toolbox/{sandboxId}/toolbox/computer/keyboard/key | Press key
[**replace_in_files**](ToolboxApi.md#replace_in_files) | **POST** /toolbox/{sandboxId}/toolbox/files/replace | Replace in files
[**restart_process**](ToolboxApi.md#restart_process) | **POST** /toolbox/{sandboxId}/toolbox/computer/process/{processName}/restart | Restart process
[**scroll_mouse**](ToolboxApi.md#scroll_mouse) | **POST** /toolbox/{sandboxId}/toolbox/computer/mouse/scroll | Scroll mouse
[**search_files**](ToolboxApi.md#search_files) | **GET** /toolbox/{sandboxId}/toolbox/files/search | Search files
[**set_file_permissions**](ToolboxApi.md#set_file_permissions) | **POST** /toolbox/{sandboxId}/toolbox/files/permissions | Set file permissions
[**start_computer**](ToolboxApi.md#start_computer) | **POST** /toolbox/{sandboxId}/toolbox/computer/start | Start computer processes
[**stop_computer**](ToolboxApi.md#stop_computer) | **POST** /toolbox/{sandboxId}/toolbox/computer/stop | Stop computer processes
[**take_compressed_region_screenshot**](ToolboxApi.md#take_compressed_region_screenshot) | **GET** /toolbox/{sandboxId}/toolbox/computer/screenshot/region/compressed | Take compressed region screenshot
[**take_compressed_screenshot**](ToolboxApi.md#take_compressed_screenshot) | **GET** /toolbox/{sandboxId}/toolbox/computer/screenshot/compressed | Take compressed screenshot
[**take_region_screenshot**](ToolboxApi.md#take_region_screenshot) | **GET** /toolbox/{sandboxId}/toolbox/computer/screenshot/region | Take region screenshot
[**take_screenshot**](ToolboxApi.md#take_screenshot) | **GET** /toolbox/{sandboxId}/toolbox/computer/screenshot | Take screenshot
[**type_text**](ToolboxApi.md#type_text) | **POST** /toolbox/{sandboxId}/toolbox/computer/keyboard/type | Type text
[**upload_file**](ToolboxApi.md#upload_file) | **POST** /toolbox/{sandboxId}/toolbox/files/upload | Upload file
[**upload_files**](ToolboxApi.md#upload_files) | **POST** /toolbox/{sandboxId}/toolbox/files/bulk-upload | Upload multiple files



## click_mouse

> models::MouseClickResponse click_mouse(sandbox_id, mouse_click_request, x_snapflow_organization_id)
Click mouse

Click mouse at specified coordinates

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**mouse_click_request** | [**MouseClickRequest**](MouseClickRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::MouseClickResponse**](MouseClickResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## create_folder

> create_folder(sandbox_id, path, mode, x_snapflow_organization_id)
Create folder

Create folder inside sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**mode** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## create_session

> create_session(sandbox_id, create_session_request, x_snapflow_organization_id)
Create session

Create a new session in the sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**create_session_request** | [**CreateSessionRequest**](CreateSessionRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_file

> delete_file(sandbox_id, path, x_snapflow_organization_id)
Delete file

Delete file inside sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_session

> delete_session(sandbox_id, session_id, x_snapflow_organization_id)
Delete session

Delete a specific session

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**session_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## download_file

> std::path::PathBuf download_file(sandbox_id, path, x_snapflow_organization_id)
Download file

Download file from sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**std::path::PathBuf**](std::path::PathBuf.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## drag_mouse

> models::MouseDragResponse drag_mouse(sandbox_id, mouse_drag_request, x_snapflow_organization_id)
Drag mouse

Drag mouse from start to end coordinates

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**mouse_drag_request** | [**MouseDragRequest**](MouseDragRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::MouseDragResponse**](MouseDragResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## execute_command

> models::ExecuteResponse execute_command(sandbox_id, execute_request, x_snapflow_organization_id)
Execute command

Execute command synchronously inside sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**execute_request** | [**ExecuteRequest**](ExecuteRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::ExecuteResponse**](ExecuteResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## execute_session_command

> models::SessionExecuteResponse execute_session_command(sandbox_id, session_id, session_execute_request, x_snapflow_organization_id)
Execute command in session

Execute a command in a specific session

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**session_id** | **String** |  | [required] |
**session_execute_request** | [**SessionExecuteRequest**](SessionExecuteRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::SessionExecuteResponse**](SessionExecuteResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## find_in_files

> Vec<models::Match> find_in_files(sandbox_id, path, pattern, x_snapflow_organization_id)
Search for text/pattern in files

Search for text/pattern inside sandbox files

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**pattern** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**Vec<models::Match>**](Match.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_computer_status

> models::ComputerStatusResponse get_computer_status(sandbox_id, x_snapflow_organization_id)
Get computer status

Get status of all VNC desktop processes

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::ComputerStatusResponse**](ComputerStatusResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_display_info

> models::DisplayInfoResponse get_display_info(sandbox_id, x_snapflow_organization_id)
Get display info

Get information about displays

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::DisplayInfoResponse**](DisplayInfoResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_file_info

> models::FileInfo get_file_info(sandbox_id, path, x_snapflow_organization_id)
Get file info

Get file info inside sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::FileInfo**](FileInfo.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_mouse_position

> models::MousePosition get_mouse_position(sandbox_id, x_snapflow_organization_id)
Get mouse position

Get current mouse cursor position

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::MousePosition**](MousePosition.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_process_errors

> models::ProcessErrorsResponse get_process_errors(process_name, sandbox_id, x_snapflow_organization_id)
Get process errors

Get error logs for a specific VNC process

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**process_name** | **String** |  | [required] |
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::ProcessErrorsResponse**](ProcessErrorsResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_process_logs

> models::ProcessLogsResponse get_process_logs(process_name, sandbox_id, x_snapflow_organization_id)
Get process logs

Get logs for a specific VNC process

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**process_name** | **String** |  | [required] |
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::ProcessLogsResponse**](ProcessLogsResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_process_status

> models::ProcessStatusResponse get_process_status(process_name, sandbox_id, x_snapflow_organization_id)
Get process status

Get status of a specific VNC process

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**process_name** | **String** |  | [required] |
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::ProcessStatusResponse**](ProcessStatusResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_project_dir

> models::ProjectDirResponse get_project_dir(sandbox_id, x_snapflow_organization_id)
Get sandbox project dir

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::ProjectDirResponse**](ProjectDirResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_session

> models::Session get_session(sandbox_id, session_id, x_snapflow_organization_id)
Get session

Get session by ID

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**session_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::Session**](Session.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_session_command

> models::Command get_session_command(sandbox_id, session_id, command_id, x_snapflow_organization_id)
Get session command

Get session command by ID

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**session_id** | **String** |  | [required] |
**command_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::Command**](Command.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_session_command_logs

> String get_session_command_logs(sandbox_id, session_id, command_id, x_snapflow_organization_id, follow)
Get command logs

Get logs for a specific command in a session

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**session_id** | **String** |  | [required] |
**command_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |
**follow** | Option<**bool**> |  |  |

### Return type

**String**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_windows

> models::WindowsResponse get_windows(sandbox_id, x_snapflow_organization_id)
Get windows

Get list of open windows

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::WindowsResponse**](WindowsResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_add_files

> git_add_files(sandbox_id, git_add_request, x_snapflow_organization_id)
Add files

Add files to git commit

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**git_add_request** | [**GitAddRequest**](GitAddRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_checkout_branch

> git_checkout_branch(sandbox_id, git_checkout_request, x_snapflow_organization_id)
Checkout branch

Checkout branch or commit in git repository

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**git_checkout_request** | [**GitCheckoutRequest**](GitCheckoutRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_clone_repository

> git_clone_repository(sandbox_id, git_clone_request, x_snapflow_organization_id)
Clone repository

Clone git repository

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**git_clone_request** | [**GitCloneRequest**](GitCloneRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_commit_changes

> models::GitCommitResponse git_commit_changes(sandbox_id, git_commit_request, x_snapflow_organization_id)
Commit changes

Commit changes to git repository

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**git_commit_request** | [**GitCommitRequest**](GitCommitRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::GitCommitResponse**](GitCommitResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_create_branch

> git_create_branch(sandbox_id, git_branch_request, x_snapflow_organization_id)
Create branch

Create branch on git repository

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**git_branch_request** | [**GitBranchRequest**](GitBranchRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_delete_branch

> git_delete_branch(sandbox_id, git_delete_branch_request, x_snapflow_organization_id)
Delete branch

Delete branch on git repository

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**git_delete_branch_request** | [**GitDeleteBranchRequest**](GitDeleteBranchRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_get_history

> Vec<models::GitCommitInfo> git_get_history(sandbox_id, path, x_snapflow_organization_id)
Get commit history

Get commit history from git repository

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**Vec<models::GitCommitInfo>**](GitCommitInfo.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_get_status

> models::GitStatus git_get_status(sandbox_id, path, x_snapflow_organization_id)
Get git status

Get status from git repository

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::GitStatus**](GitStatus.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_list_branches

> models::ListBranchResponse git_list_branches(sandbox_id, path, x_snapflow_organization_id)
Get branch list

Get branch list from git repository

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::ListBranchResponse**](ListBranchResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_pull_changes

> git_pull_changes(sandbox_id, git_repo_request, x_snapflow_organization_id)
Pull changes

Pull changes from remote

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**git_repo_request** | [**GitRepoRequest**](GitRepoRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## git_push_changes

> git_push_changes(sandbox_id, git_repo_request, x_snapflow_organization_id)
Push changes

Push changes to remote

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**git_repo_request** | [**GitRepoRequest**](GitRepoRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_files

> Vec<models::FileInfo> list_files(sandbox_id, x_snapflow_organization_id, path)
List files

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |
**path** | Option<**String**> |  |  |

### Return type

[**Vec<models::FileInfo>**](FileInfo.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_sessions

> Vec<models::Session> list_sessions(sandbox_id, x_snapflow_organization_id)
List sessions

List all active sessions in the sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**Vec<models::Session>**](Session.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## lsp_completions

> models::CompletionList lsp_completions(sandbox_id, lsp_completion_params, x_snapflow_organization_id)
Get Lsp Completions

The Completion request is sent from the client to the server to compute completion items at a given cursor position.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**lsp_completion_params** | [**LspCompletionParams**](LspCompletionParams.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::CompletionList**](CompletionList.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## lsp_did_close

> lsp_did_close(sandbox_id, lsp_document_request, x_snapflow_organization_id)
Call Lsp DidClose

The document close notification is sent from the client to the server when the document got closed in the client.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**lsp_document_request** | [**LspDocumentRequest**](LspDocumentRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## lsp_did_open

> lsp_did_open(sandbox_id, lsp_document_request, x_snapflow_organization_id)
Call Lsp DidOpen

The document open notification is sent from the client to the server to signal newly opened text documents.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**lsp_document_request** | [**LspDocumentRequest**](LspDocumentRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## lsp_document_symbols

> Vec<models::LspSymbol> lsp_document_symbols(sandbox_id, language_id, path_to_project, uri, x_snapflow_organization_id)
Call Lsp DocumentSymbols

The document symbol request is sent from the client to the server.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**language_id** | **String** |  | [required] |
**path_to_project** | **String** |  | [required] |
**uri** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**Vec<models::LspSymbol>**](LspSymbol.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## lsp_start

> lsp_start(sandbox_id, lsp_server_request, x_snapflow_organization_id)
Start Lsp server

Start Lsp server process inside sandbox project

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**lsp_server_request** | [**LspServerRequest**](LspServerRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## lsp_stop

> lsp_stop(sandbox_id, lsp_server_request, x_snapflow_organization_id)
Stop Lsp server

Stop Lsp server process inside sandbox project

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**lsp_server_request** | [**LspServerRequest**](LspServerRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## lsp_workspace_symbols

> Vec<models::LspSymbol> lsp_workspace_symbols(sandbox_id, language_id, path_to_project, query, x_snapflow_organization_id)
Call Lsp WorkspaceSymbols

The workspace symbol request is sent from the client to the server to list project-wide symbols matching the query string.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**language_id** | **String** |  | [required] |
**path_to_project** | **String** |  | [required] |
**query** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**Vec<models::LspSymbol>**](LspSymbol.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## move_file

> move_file(sandbox_id, source, destination, x_snapflow_organization_id)
Move file

Move file inside sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**source** | **String** |  | [required] |
**destination** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## move_mouse

> models::MouseMoveResponse move_mouse(sandbox_id, mouse_move_request, x_snapflow_organization_id)
Move mouse

Move mouse cursor to specified coordinates

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**mouse_move_request** | [**MouseMoveRequest**](MouseMoveRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::MouseMoveResponse**](MouseMoveResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## press_hotkey

> press_hotkey(sandbox_id, keyboard_hotkey_request, x_snapflow_organization_id)
Press hotkey

Press a hotkey combination

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**keyboard_hotkey_request** | [**KeyboardHotkeyRequest**](KeyboardHotkeyRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## press_key

> press_key(sandbox_id, keyboard_press_request, x_snapflow_organization_id)
Press key

Press a key with optional modifiers

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**keyboard_press_request** | [**KeyboardPressRequest**](KeyboardPressRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## replace_in_files

> Vec<models::ReplaceResult> replace_in_files(sandbox_id, replace_request, x_snapflow_organization_id)
Replace in files

Replace text/pattern in multiple files inside sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**replace_request** | [**ReplaceRequest**](ReplaceRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**Vec<models::ReplaceResult>**](ReplaceResult.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## restart_process

> models::ProcessRestartResponse restart_process(process_name, sandbox_id, x_snapflow_organization_id)
Restart process

Restart a specific VNC process

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**process_name** | **String** |  | [required] |
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::ProcessRestartResponse**](ProcessRestartResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## scroll_mouse

> models::MouseScrollResponse scroll_mouse(sandbox_id, mouse_scroll_request, x_snapflow_organization_id)
Scroll mouse

Scroll mouse at specified coordinates

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**mouse_scroll_request** | [**MouseScrollRequest**](MouseScrollRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::MouseScrollResponse**](MouseScrollResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## search_files

> models::SearchFilesResponse search_files(sandbox_id, path, pattern, x_snapflow_organization_id)
Search files

Search for files inside sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**pattern** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::SearchFilesResponse**](SearchFilesResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## set_file_permissions

> set_file_permissions(sandbox_id, path, x_snapflow_organization_id, owner, group, mode)
Set file permissions

Set file owner/group/permissions inside sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |
**owner** | Option<**String**> |  |  |
**group** | Option<**String**> |  |  |
**mode** | Option<**String**> |  |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## start_computer

> models::ComputerStartResponse start_computer(sandbox_id, x_snapflow_organization_id)
Start computer processes

Start all VNC desktop processes (Xvfb, xfce4, x11vnc, novnc)

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::ComputerStartResponse**](ComputerStartResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## stop_computer

> models::ComputerStopResponse stop_computer(sandbox_id, x_snapflow_organization_id)
Stop computer processes

Stop all VNC desktop processes (Xvfb, xfce4, x11vnc, novnc)

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

[**models::ComputerStopResponse**](ComputerStopResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## take_compressed_region_screenshot

> models::CompressedScreenshotResponse take_compressed_region_screenshot(sandbox_id, height, width, y, x, x_snapflow_organization_id, scale, quality, format, show_cursor)
Take compressed region screenshot

Take a compressed screenshot of a specific region

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**height** | **f64** |  | [required] |
**width** | **f64** |  | [required] |
**y** | **f64** |  | [required] |
**x** | **f64** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |
**scale** | Option<**f64**> |  |  |
**quality** | Option<**f64**> |  |  |
**format** | Option<**String**> |  |  |
**show_cursor** | Option<**bool**> |  |  |

### Return type

[**models::CompressedScreenshotResponse**](CompressedScreenshotResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## take_compressed_screenshot

> models::CompressedScreenshotResponse take_compressed_screenshot(sandbox_id, x_snapflow_organization_id, scale, quality, format, show_cursor)
Take compressed screenshot

Take a compressed screenshot with format, quality, and scale options

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |
**scale** | Option<**f64**> |  |  |
**quality** | Option<**f64**> |  |  |
**format** | Option<**String**> |  |  |
**show_cursor** | Option<**bool**> |  |  |

### Return type

[**models::CompressedScreenshotResponse**](CompressedScreenshotResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## take_region_screenshot

> models::RegionScreenshotResponse take_region_screenshot(sandbox_id, height, width, y, x, x_snapflow_organization_id, show_cursor)
Take region screenshot

Take a screenshot of a specific region

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**height** | **f64** |  | [required] |
**width** | **f64** |  | [required] |
**y** | **f64** |  | [required] |
**x** | **f64** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |
**show_cursor** | Option<**bool**> |  |  |

### Return type

[**models::RegionScreenshotResponse**](RegionScreenshotResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## take_screenshot

> models::ScreenshotResponse take_screenshot(sandbox_id, x_snapflow_organization_id, show_cursor)
Take screenshot

Take a screenshot of the entire screen

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |
**show_cursor** | Option<**bool**> |  |  |

### Return type

[**models::ScreenshotResponse**](ScreenshotResponse.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## type_text

> type_text(sandbox_id, keyboard_type_request, x_snapflow_organization_id)
Type text

Type text using keyboard

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**keyboard_type_request** | [**KeyboardTypeRequest**](KeyboardTypeRequest.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## upload_file

> upload_file(sandbox_id, path, x_snapflow_organization_id, file)
Upload file

Upload file inside sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**path** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |
**file** | Option<**std::path::PathBuf**> |  |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## upload_files

> upload_files(sandbox_id, x_snapflow_organization_id)
Upload multiple files

Upload multiple files inside sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Use with JWT to specify the organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: multipart/form-data
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

