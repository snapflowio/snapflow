# CreateSandboxDTO


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**buckets** | [**Array&lt;DtoBucketDTO&gt;**](DtoBucketDTO.md) |  | [optional] [default to undefined]
**cpuQuota** | **number** |  | [optional] [default to undefined]
**entrypoint** | **Array&lt;string&gt;** |  | [optional] [default to undefined]
**env** | **{ [key: string]: string; }** |  | [optional] [default to undefined]
**fromBucketId** | **string** |  | [optional] [default to undefined]
**gpuQuota** | **number** |  | [optional] [default to undefined]
**id** | **string** |  | [default to undefined]
**image** | **string** |  | [default to undefined]
**memoryQuota** | **number** |  | [optional] [default to undefined]
**osUser** | **string** |  | [default to undefined]
**registry** | [**RegistryDTO**](RegistryDTO.md) |  | [optional] [default to undefined]
**storageQuota** | **number** |  | [optional] [default to undefined]
**userId** | **string** |  | [default to undefined]

## Example

```typescript
import { CreateSandboxDTO } from './api';

const instance: CreateSandboxDTO = {
    buckets,
    cpuQuota,
    entrypoint,
    env,
    fromBucketId,
    gpuQuota,
    id,
    image,
    memoryQuota,
    osUser,
    registry,
    storageQuota,
    userId,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
