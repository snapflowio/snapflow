# CreateSandbox

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**auto_archive_interval** | Option<**i32**> |  | [optional]
**auto_delete_interval** | Option<**i32**> |  | [optional]
**auto_stop_interval** | Option<**i32**> |  | [optional]
**buckets** | Option<[**Vec<models::SandboxBucketRef>**](SandboxBucketRef.md)> |  | [optional]
**build_info** | Option<[**models::CreateBuildInfo**](CreateBuildInfo.md)> |  | [optional]
**class** | Option<[**models::SandboxClass**](SandboxClass.md)> |  | [optional]
**cpu** | Option<**i32**> |  | [optional]
**disk** | Option<**i32**> |  | [optional]
**env** | Option<**std::collections::HashMap<String, String>**> |  | [optional]
**gpu** | Option<**i32**> |  | [optional]
**image** | Option<**String**> |  | [optional]
**labels** | Option<**std::collections::HashMap<String, String>**> |  | [optional]
**memory** | Option<**i32**> |  | [optional]
**network_allow_list** | Option<**String**> |  | [optional]
**network_block_all** | Option<**bool**> |  | [optional]
**public** | Option<**bool**> |  | [optional]
**target** | Option<**String**> |  | [optional]
**user** | Option<**String**> |  | [optional]

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


