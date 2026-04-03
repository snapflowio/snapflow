# \BucketsApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_bucket**](BucketsApi.md#create_bucket) | **POST** /buckets | Create a new bucket
[**delete_bucket**](BucketsApi.md#delete_bucket) | **DELETE** /buckets/{bucketId} | Delete bucket
[**get_bucket**](BucketsApi.md#get_bucket) | **GET** /buckets/{bucketId} | Get bucket details
[**get_bucket_by_name**](BucketsApi.md#get_bucket_by_name) | **GET** /buckets/by-name/{name} | Get bucket details by name
[**list_buckets**](BucketsApi.md#list_buckets) | **GET** /buckets | List all buckets



## create_bucket

> models::Bucket create_bucket(create_bucket, x_snapflow_organization_id)
Create a new bucket

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**create_bucket** | [**CreateBucket**](CreateBucket.md) |  | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Bucket**](Bucket.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## delete_bucket

> delete_bucket(bucket_id, x_snapflow_organization_id)
Delete bucket

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**bucket_id** | **uuid::Uuid** | ID of the bucket | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

 (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_bucket

> models::Bucket get_bucket(bucket_id, x_snapflow_organization_id)
Get bucket details

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**bucket_id** | **uuid::Uuid** | ID of the bucket | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Bucket**](Bucket.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## get_bucket_by_name

> models::Bucket get_bucket_by_name(name, x_snapflow_organization_id)
Get bucket details by name

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**name** | **String** | Name of the bucket | [required] |
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |

### Return type

[**models::Bucket**](Bucket.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## list_buckets

> Vec<models::Bucket> list_buckets(x_snapflow_organization_id, include_deleted)
List all buckets

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**x_snapflow_organization_id** | Option<**String**> | Organization ID |  |
**include_deleted** | Option<**bool**> | Include deleted buckets in the response |  |

### Return type

[**Vec<models::Bucket>**](Bucket.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

