# \ImagesApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**activate_image**](ImagesApi.md#activate_image) | **POST** /images/{id}/activate | Activate an image
[**can_cleanup_image**](ImagesApi.md#can_cleanup_image) | **GET** /images/can-cleanup-image | Check if an image can be cleaned up
[**create_image**](ImagesApi.md#create_image) | **POST** /images | Create a new image
[**deactivate_image**](ImagesApi.md#deactivate_image) | **POST** /images/{id}/deactivate | Deactivate an image
[**delete_image**](ImagesApi.md#delete_image) | **DELETE** /images/{id} | Delete an image
[**get_image**](ImagesApi.md#get_image) | **GET** /images/{id} | Get image by ID or name
[**get_image_build_logs**](ImagesApi.md#get_image_build_logs) | **GET** /images/{id}/build-logs | Get image build logs
[**list_images**](ImagesApi.md#list_images) | **GET** /images | List all images with pagination
[**set_image_general_status**](ImagesApi.md#set_image_general_status) | **PATCH** /images/{id}/general | Set image general status



## activate_image

> models::Image activate_image(id, x_snapflow_organization_id)
Activate an image

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **uuid::Uuid** | ID of the image | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Image**](Image.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## can_cleanup_image

> bool can_cleanup_image(image_name, x_snapflow_organization_id)
Check if an image can be cleaned up

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**image_name** | **String** | Name of the image to check | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

**bool**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: text/plain

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## create_image

> models::Image create_image(create_image, x_snapflow_organization_id)
Create a new image

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**create_image** | [**CreateImage**](CreateImage.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Image**](Image.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## deactivate_image

> deactivate_image(id, x_snapflow_organization_id)
Deactivate an image

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **uuid::Uuid** | ID of the image | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_image

> delete_image(id, x_snapflow_organization_id)
Delete an image

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **String** | ID of the image | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_image

> models::Image get_image(id, x_snapflow_organization_id)
Get image by ID or name

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **String** | ID or name of the image | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Image**](Image.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_image_build_logs

> get_image_build_logs(id, x_snapflow_organization_id, follow)
Get image build logs

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **String** | ID of the image | [required] |
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


## list_images

> models::PaginatedImages list_images(x_snapflow_organization_id, page, limit)
List all images with pagination

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |
**page** | Option<**i64**> | Page number (default: 1) |  |
**limit** | Option<**i64**> | Number of items per page (default: 10) |  |

### Return type

[**models::PaginatedImages**](PaginatedImages.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## set_image_general_status

> models::Image set_image_general_status(id, set_image_general_status, x_snapflow_organization_id)
Set image general status

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**id** | **uuid::Uuid** | ID of the image | [required] |
**set_image_general_status** | [**SetImageGeneralStatus**](SetImageGeneralStatus.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Image**](Image.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

