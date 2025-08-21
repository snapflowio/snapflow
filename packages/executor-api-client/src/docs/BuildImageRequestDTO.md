# BuildImageRequestDTO


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**context** | **Array&lt;string&gt;** |  | [optional] [default to undefined]
**dockerfile** | **string** |  | [default to undefined]
**image** | **string** | Image ID and tag or the build\&#39;s hash | [optional] [default to undefined]
**organizationId** | **string** |  | [default to undefined]
**pushToInternalRegistry** | **boolean** |  | [optional] [default to undefined]
**registry** | [**RegistryDTO**](RegistryDTO.md) |  | [optional] [default to undefined]

## Example

```typescript
import { BuildImageRequestDTO } from './api';

const instance: BuildImageRequestDTO = {
    context,
    dockerfile,
    image,
    organizationId,
    pushToInternalRegistry,
    registry,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
