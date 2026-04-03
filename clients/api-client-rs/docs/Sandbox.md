# Sandbox

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**auto_delete_interval** | Option<**i32**> |  | [optional]
**auto_stop_interval** | Option<**i32**> |  | [optional]
**backup_created_at** | Option<**String**> |  | [optional]
**backup_state** | Option<[**models::BackupState**](BackupState.md)> |  | [optional]
**buckets** | Option<[**Vec<models::SandboxBucketRef>**](SandboxBucketRef.md)> |  | [optional]
**build_info** | Option<[**models::BuildInfo**](BuildInfo.md)> |  | [optional]
**class** | Option<[**models::SandboxClass**](SandboxClass.md)> |  | [optional]
**cpu** | **i32** |  | 
**created_at** | Option<**String**> |  | [optional]
**desired_state** | Option<[**models::SandboxDesiredState**](SandboxDesiredState.md)> |  | [optional]
**disk** | **i32** |  | 
**env** | **std::collections::HashMap<String, String>** |  | 
**error_reason** | Option<**String**> |  | [optional]
**executor_domain** | Option<**String**> |  | [optional]
**gpu** | **i32** |  | 
**id** | [**uuid::Uuid**](uuid::Uuid.md) |  | 
**image** | Option<**String**> |  | [optional]
**labels** | **std::collections::HashMap<String, String>** |  | 
**memory** | **i32** |  | 
**network_allow_list** | Option<**String**> |  | [optional]
**network_block_all** | **bool** |  | 
**node_version** | Option<**String**> |  | [optional]
**organization_id** | [**uuid::Uuid**](uuid::Uuid.md) |  | 
**public** | **bool** |  | 
**state** | Option<[**models::SandboxState**](SandboxState.md)> |  | [optional]
**target** | **String** |  | 
**toolbox_proxy_url** | Option<**String**> |  | [optional]
**updated_at** | Option<**String**> |  | [optional]
**user** | **String** |  | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


