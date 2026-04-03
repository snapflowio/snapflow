# \SandboxApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create**](SandboxApi.md#create) | **POST** /sandboxes | Create a sandbox
[**create_backup**](SandboxApi.md#create_backup) | **POST** /sandboxes/{sandboxId}/backup | Create a backup of a sandbox
[**destroy**](SandboxApi.md#destroy) | **POST** /sandboxes/{sandboxId}/destroy | Destroy sandbox
[**info**](SandboxApi.md#info) | **GET** /sandboxes/{sandboxId} | Get sandbox info
[**remove_destroyed**](SandboxApi.md#remove_destroyed) | **DELETE** /sandboxes/{sandboxId} | Remove a destroyed sandbox
[**resize**](SandboxApi.md#resize) | **POST** /sandboxes/{sandboxId}/resize | Resize sandbox
[**start**](SandboxApi.md#start) | **POST** /sandboxes/{sandboxId}/start | Start sandbox
[**stop**](SandboxApi.md#stop) | **POST** /sandboxes/{sandboxId}/stop | Stop sandbox



## create

> String create(create_sandbox_dto)
Create a sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**create_sandbox_dto** | [**CreateSandboxDto**](CreateSandboxDto.md) |  | [required] |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## create_backup

> String create_backup(sandbox_id, create_backup_dto)
Create a backup of a sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** | Sandbox ID | [required] |
**create_backup_dto** | [**CreateBackupDto**](CreateBackupDto.md) |  | [required] |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## destroy

> String destroy(sandbox_id)
Destroy sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** | Sandbox ID | [required] |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## info

> models::SandboxInfoResponse info(sandbox_id)
Get sandbox info

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** | Sandbox ID | [required] |

### Return type

[**models::SandboxInfoResponse**](SandboxInfoResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## remove_destroyed

> String remove_destroyed(sandbox_id)
Remove a destroyed sandbox

Remove a sandbox that has been previously destroyed

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** | Sandbox ID | [required] |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## resize

> String resize(sandbox_id, resize_sandbox_dto)
Resize sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** | Sandbox ID | [required] |
**resize_sandbox_dto** | [**ResizeSandboxDto**](ResizeSandboxDto.md) |  | [required] |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## start

> String start(sandbox_id)
Start sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** | Sandbox ID | [required] |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## stop

> String stop(sandbox_id)
Stop sandbox

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **String** | Sandbox ID | [required] |

### Return type

**String**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain, application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

