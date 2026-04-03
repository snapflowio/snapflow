# \ExecutorsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_executor**](ExecutorsApi.md#create_executor) | **POST** /executors | Create executor
[**get_executor_by_sandbox_id**](ExecutorsApi.md#get_executor_by_sandbox_id) | **GET** /executors/by-sandbox/{sandboxId} | Get executor by sandbox ID
[**get_executors_by_image_ref**](ExecutorsApi.md#get_executors_by_image_ref) | **GET** /executors/by-image-ref | Get executors by image ref
[**list_executors**](ExecutorsApi.md#list_executors) | **GET** /executors | List all executors
[**update_executor_scheduling**](ExecutorsApi.md#update_executor_scheduling) | **PATCH** /executors/{id}/scheduling | Update executor scheduling status



## create_executor

> models::Executor create_executor(create_executor)
Create executor

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**create_executor** | [**CreateExecutor**](CreateExecutor.md) |  | [required] |

### Return type

[**models::Executor**](Executor.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_executor_by_sandbox_id

> models::Executor get_executor_by_sandbox_id(sandbox_id)
Get executor by sandbox ID

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**sandbox_id** | **uuid::Uuid** | ID of the sandbox | [required] |

### Return type

[**models::Executor**](Executor.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_executors_by_image_ref

> Vec<models::ExecutorImage> get_executors_by_image_ref(r#ref)
Get executors by image ref

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**r#ref** | **String** | Image ref | [required] |

### Return type

[**Vec<models::ExecutorImage>**](ExecutorImage.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_executors

> Vec<models::Executor> list_executors()
List all executors

### Parameters

This endpoint does not need any parameter.

### Return type

[**Vec<models::Executor>**](Executor.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## update_executor_scheduling

> models::Executor update_executor_scheduling(id, update_scheduling_body)
Update executor scheduling status

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **uuid::Uuid** | ID of the executor | [required] |
**update_scheduling_body** | [**UpdateSchedulingBody**](UpdateSchedulingBody.md) |  | [required] |

### Return type

[**models::Executor**](Executor.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

