# \SandboxApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**archive_sandbox**](SandboxApi.md#archive_sandbox) | **POST** /sandbox/{sandboxId}/archive | Archive sandbox
[**create_backup**](SandboxApi.md#create_backup) | **POST** /sandbox/{sandboxId}/backup | Create a backup of a sandbox
[**create_sandbox**](SandboxApi.md#create_sandbox) | **POST** /sandbox | Create a new sandbox
[**delete_sandbox**](SandboxApi.md#delete_sandbox) | **DELETE** /sandbox/{sandboxId} | Delete sandbox
[**get_build_logs**](SandboxApi.md#get_build_logs) | **GET** /sandbox/{sandboxId}/build-logs | Get build logs
[**get_port_preview_url**](SandboxApi.md#get_port_preview_url) | **GET** /sandbox/{sandboxId}/ports/{port}/preview-url | Get preview URL for a sandbox port
[**get_sandbox**](SandboxApi.md#get_sandbox) | **GET** /sandbox/{sandboxId} | Get sandbox details
[**list_sandboxes**](SandboxApi.md#list_sandboxes) | **GET** /sandbox | List all sandboxes
[**list_sandboxes_paginated**](SandboxApi.md#list_sandboxes_paginated) | **GET** /sandbox/paginated | List all sandboxes with pagination
[**replace_labels**](SandboxApi.md#replace_labels) | **PUT** /sandbox/{sandboxId}/labels | Replace sandbox labels
[**resize_sandbox**](SandboxApi.md#resize_sandbox) | **POST** /sandbox/{sandboxId}/resize | Resize sandbox
[**set_auto_delete_interval**](SandboxApi.md#set_auto_delete_interval) | **POST** /sandbox/{sandboxId}/autodelete/{interval} | Set sandbox auto-delete interval
[**set_autostop_interval**](SandboxApi.md#set_autostop_interval) | **POST** /sandbox/{sandboxId}/autostop/{interval} | Set sandbox auto-stop interval
[**start_sandbox**](SandboxApi.md#start_sandbox) | **POST** /sandbox/{sandboxId}/start | Start sandbox
[**stop_sandbox**](SandboxApi.md#stop_sandbox) | **POST** /sandbox/{sandboxId}/stop | Stop sandbox
[**update_last_activity**](SandboxApi.md#update_last_activity) | **POST** /sandbox/{sandboxId}/activity | Update sandbox last activity timestamp
[**update_public_status**](SandboxApi.md#update_public_status) | **POST** /sandbox/{sandboxId}/public/{isPublic} | Update public status



## archive_sandbox

> archive_sandbox(sandbox_id, x_snapflow_organization_id)
Archive sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## create_backup

> create_backup(sandbox_id, x_snapflow_organization_id)
Create a backup of a sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## create_sandbox

> models::Sandbox create_sandbox(create_sandbox, x_snapflow_organization_id)
Create a new sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**create_sandbox** | [**CreateSandbox**](CreateSandbox.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Sandbox**](Sandbox.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_sandbox

> delete_sandbox(sandbox_id, x_snapflow_organization_id)
Delete sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_build_logs

> get_build_logs(sandbox_id, x_snapflow_organization_id, follow)
Get build logs

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |
**follow** | Option<**bool**> | Whether to follow the logs stream |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_port_preview_url

> models::PortPreviewUrl get_port_preview_url(sandbox_id, port, x_snapflow_organization_id)
Get preview URL for a sandbox port

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**port** | **i32** | Port number | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::PortPreviewUrl**](PortPreviewUrl.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_sandbox

> models::Sandbox get_sandbox(sandbox_id, x_snapflow_organization_id)
Get sandbox details

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Sandbox**](Sandbox.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_sandboxes

> Vec<models::Sandbox> list_sandboxes(x_snapflow_organization_id, verbose, labels, include_errored_deleted)
List all sandboxes

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |
**verbose** | Option<**bool**> | Include verbose output |  |
**labels** | Option<**String**> | JSON encoded labels to filter by |  |
**include_errored_deleted** | Option<**bool**> | Include errored and deleted sandboxes |  |

### Return type

[**Vec<models::Sandbox>**](Sandbox.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_sandboxes_paginated

> models::PaginatedSandboxes list_sandboxes_paginated(x_snapflow_organization_id, page, limit, labels, include_errored_deleted)
List all sandboxes with pagination

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |
**page** | Option<**i64**> | Page number (default: 1) |  |
**limit** | Option<**i64**> | Number of items per page (default: 10) |  |
**labels** | Option<**String**> | JSON encoded labels to filter by |  |
**include_errored_deleted** | Option<**bool**> | Include errored and deleted sandboxes |  |

### Return type

[**models::PaginatedSandboxes**](PaginatedSandboxes.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## replace_labels

> models::UpdateSandboxLabels replace_labels(sandbox_id, update_sandbox_labels, x_snapflow_organization_id)
Replace sandbox labels

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**update_sandbox_labels** | [**UpdateSandboxLabels**](UpdateSandboxLabels.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::UpdateSandboxLabels**](UpdateSandboxLabels.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## resize_sandbox

> resize_sandbox(sandbox_id, resize_sandbox, x_snapflow_organization_id)
Resize sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**resize_sandbox** | [**ResizeSandbox**](ResizeSandbox.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## set_auto_delete_interval

> set_auto_delete_interval(sandbox_id, interval, x_snapflow_organization_id)
Set sandbox auto-delete interval

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**interval** | **i32** | Auto-delete interval in minutes | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## set_autostop_interval

> set_autostop_interval(sandbox_id, interval, x_snapflow_organization_id)
Set sandbox auto-stop interval

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**interval** | **i32** | Auto-stop interval in minutes (0 to disable) | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## start_sandbox

> models::Sandbox start_sandbox(sandbox_id, x_snapflow_organization_id)
Start sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Sandbox**](Sandbox.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## stop_sandbox

> stop_sandbox(sandbox_id, x_snapflow_organization_id)
Stop sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## update_last_activity

> update_last_activity(sandbox_id, x_snapflow_organization_id)
Update sandbox last activity timestamp

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## update_public_status

> update_public_status(sandbox_id, is_public, x_snapflow_organization_id)
Update public status

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |
**is_public** | **bool** | Public status to set | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

