# Sandbox

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **string** | The ID of the sandbox | 
**OrganizationId** | **string** | The organization ID of the sandbox | 
**Image** | Pointer to **string** | The image used for the sandbox | [optional] 
**User** | **string** | The user associated with the project | 
**Env** | **map[string]string** | Environment variables for the sandbox | 
**Labels** | **map[string]string** | Labels for the sandbox | 
**Public** | **bool** | Whether the sandbox http preview is public | 
**Target** | **string** | The target environment for the sandbox | 
**Cpu** | **float32** | The CPU quota for the sandbox | 
**Gpu** | **float32** | The GPU quota for the sandbox | 
**Memory** | **float32** | The memory quota for the sandbox | 
**Disk** | **float32** | The disk quota for the sandbox | 
**State** | Pointer to [**SandboxState**](SandboxState.md) | The state of the sandbox | [optional] 
**DesiredState** | Pointer to [**SandboxDesiredState**](SandboxDesiredState.md) | The desired state of the sandbox | [optional] 
**ErrorReason** | Pointer to **string** | The error reason of the sandbox | [optional] 
**BackupState** | Pointer to **string** | The state of the backup | [optional] 
**BackupCreatedAt** | Pointer to **string** | The creation timestamp of the last backup | [optional] 
**AutoStopInterval** | Pointer to **float32** | Auto-stop interval in minutes (0 means disabled) | [optional] 
**AutoArchiveInterval** | Pointer to **float32** | Auto-archive interval in minutes | [optional] 
**ExecutorDomain** | Pointer to **string** | The domain name of the executor | [optional] 
**Buckets** | Pointer to [**[]SandboxBucket**](SandboxBucket.md) | Array of buckets attached to the sandbox | [optional] 
**BuildInfo** | Pointer to [**BuildInfo**](BuildInfo.md) | Build information for the sandbox | [optional] 
**CreatedAt** | Pointer to **string** | The creation timestamp of the sandbox | [optional] 
**UpdatedAt** | Pointer to **string** | The last update timestamp of the sandbox | [optional] 
**Class** | Pointer to **string** | The class of the sandbox | [optional] 
**DaemonVersion** | Pointer to **string** | The version of the node running in the sandbox | [optional] 

## Methods

### NewSandbox

`func NewSandbox(id string, organizationId string, user string, env map[string]string, labels map[string]string, public bool, target string, cpu float32, gpu float32, memory float32, disk float32, ) *Sandbox`

NewSandbox instantiates a new Sandbox object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSandboxWithDefaults

`func NewSandboxWithDefaults() *Sandbox`

NewSandboxWithDefaults instantiates a new Sandbox object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *Sandbox) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *Sandbox) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *Sandbox) SetId(v string)`

SetId sets Id field to given value.


### GetOrganizationId

`func (o *Sandbox) GetOrganizationId() string`

GetOrganizationId returns the OrganizationId field if non-nil, zero value otherwise.

### GetOrganizationIdOk

`func (o *Sandbox) GetOrganizationIdOk() (*string, bool)`

GetOrganizationIdOk returns a tuple with the OrganizationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOrganizationId

`func (o *Sandbox) SetOrganizationId(v string)`

SetOrganizationId sets OrganizationId field to given value.


### GetImage

`func (o *Sandbox) GetImage() string`

GetImage returns the Image field if non-nil, zero value otherwise.

### GetImageOk

`func (o *Sandbox) GetImageOk() (*string, bool)`

GetImageOk returns a tuple with the Image field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImage

`func (o *Sandbox) SetImage(v string)`

SetImage sets Image field to given value.

### HasImage

`func (o *Sandbox) HasImage() bool`

HasImage returns a boolean if a field has been set.

### GetUser

`func (o *Sandbox) GetUser() string`

GetUser returns the User field if non-nil, zero value otherwise.

### GetUserOk

`func (o *Sandbox) GetUserOk() (*string, bool)`

GetUserOk returns a tuple with the User field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUser

`func (o *Sandbox) SetUser(v string)`

SetUser sets User field to given value.


### GetEnv

`func (o *Sandbox) GetEnv() map[string]string`

GetEnv returns the Env field if non-nil, zero value otherwise.

### GetEnvOk

`func (o *Sandbox) GetEnvOk() (*map[string]string, bool)`

GetEnvOk returns a tuple with the Env field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEnv

`func (o *Sandbox) SetEnv(v map[string]string)`

SetEnv sets Env field to given value.


### GetLabels

`func (o *Sandbox) GetLabels() map[string]string`

GetLabels returns the Labels field if non-nil, zero value otherwise.

### GetLabelsOk

`func (o *Sandbox) GetLabelsOk() (*map[string]string, bool)`

GetLabelsOk returns a tuple with the Labels field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabels

`func (o *Sandbox) SetLabels(v map[string]string)`

SetLabels sets Labels field to given value.


### GetPublic

`func (o *Sandbox) GetPublic() bool`

GetPublic returns the Public field if non-nil, zero value otherwise.

### GetPublicOk

`func (o *Sandbox) GetPublicOk() (*bool, bool)`

GetPublicOk returns a tuple with the Public field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPublic

`func (o *Sandbox) SetPublic(v bool)`

SetPublic sets Public field to given value.


### GetTarget

`func (o *Sandbox) GetTarget() string`

GetTarget returns the Target field if non-nil, zero value otherwise.

### GetTargetOk

`func (o *Sandbox) GetTargetOk() (*string, bool)`

GetTargetOk returns a tuple with the Target field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTarget

`func (o *Sandbox) SetTarget(v string)`

SetTarget sets Target field to given value.


### GetCpu

`func (o *Sandbox) GetCpu() float32`

GetCpu returns the Cpu field if non-nil, zero value otherwise.

### GetCpuOk

`func (o *Sandbox) GetCpuOk() (*float32, bool)`

GetCpuOk returns a tuple with the Cpu field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCpu

`func (o *Sandbox) SetCpu(v float32)`

SetCpu sets Cpu field to given value.


### GetGpu

`func (o *Sandbox) GetGpu() float32`

GetGpu returns the Gpu field if non-nil, zero value otherwise.

### GetGpuOk

`func (o *Sandbox) GetGpuOk() (*float32, bool)`

GetGpuOk returns a tuple with the Gpu field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGpu

`func (o *Sandbox) SetGpu(v float32)`

SetGpu sets Gpu field to given value.


### GetMemory

`func (o *Sandbox) GetMemory() float32`

GetMemory returns the Memory field if non-nil, zero value otherwise.

### GetMemoryOk

`func (o *Sandbox) GetMemoryOk() (*float32, bool)`

GetMemoryOk returns a tuple with the Memory field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMemory

`func (o *Sandbox) SetMemory(v float32)`

SetMemory sets Memory field to given value.


### GetDisk

`func (o *Sandbox) GetDisk() float32`

GetDisk returns the Disk field if non-nil, zero value otherwise.

### GetDiskOk

`func (o *Sandbox) GetDiskOk() (*float32, bool)`

GetDiskOk returns a tuple with the Disk field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDisk

`func (o *Sandbox) SetDisk(v float32)`

SetDisk sets Disk field to given value.


### GetState

`func (o *Sandbox) GetState() SandboxState`

GetState returns the State field if non-nil, zero value otherwise.

### GetStateOk

`func (o *Sandbox) GetStateOk() (*SandboxState, bool)`

GetStateOk returns a tuple with the State field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetState

`func (o *Sandbox) SetState(v SandboxState)`

SetState sets State field to given value.

### HasState

`func (o *Sandbox) HasState() bool`

HasState returns a boolean if a field has been set.

### GetDesiredState

`func (o *Sandbox) GetDesiredState() SandboxDesiredState`

GetDesiredState returns the DesiredState field if non-nil, zero value otherwise.

### GetDesiredStateOk

`func (o *Sandbox) GetDesiredStateOk() (*SandboxDesiredState, bool)`

GetDesiredStateOk returns a tuple with the DesiredState field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDesiredState

`func (o *Sandbox) SetDesiredState(v SandboxDesiredState)`

SetDesiredState sets DesiredState field to given value.

### HasDesiredState

`func (o *Sandbox) HasDesiredState() bool`

HasDesiredState returns a boolean if a field has been set.

### GetErrorReason

`func (o *Sandbox) GetErrorReason() string`

GetErrorReason returns the ErrorReason field if non-nil, zero value otherwise.

### GetErrorReasonOk

`func (o *Sandbox) GetErrorReasonOk() (*string, bool)`

GetErrorReasonOk returns a tuple with the ErrorReason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetErrorReason

`func (o *Sandbox) SetErrorReason(v string)`

SetErrorReason sets ErrorReason field to given value.

### HasErrorReason

`func (o *Sandbox) HasErrorReason() bool`

HasErrorReason returns a boolean if a field has been set.

### GetBackupState

`func (o *Sandbox) GetBackupState() string`

GetBackupState returns the BackupState field if non-nil, zero value otherwise.

### GetBackupStateOk

`func (o *Sandbox) GetBackupStateOk() (*string, bool)`

GetBackupStateOk returns a tuple with the BackupState field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBackupState

`func (o *Sandbox) SetBackupState(v string)`

SetBackupState sets BackupState field to given value.

### HasBackupState

`func (o *Sandbox) HasBackupState() bool`

HasBackupState returns a boolean if a field has been set.

### GetBackupCreatedAt

`func (o *Sandbox) GetBackupCreatedAt() string`

GetBackupCreatedAt returns the BackupCreatedAt field if non-nil, zero value otherwise.

### GetBackupCreatedAtOk

`func (o *Sandbox) GetBackupCreatedAtOk() (*string, bool)`

GetBackupCreatedAtOk returns a tuple with the BackupCreatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBackupCreatedAt

`func (o *Sandbox) SetBackupCreatedAt(v string)`

SetBackupCreatedAt sets BackupCreatedAt field to given value.

### HasBackupCreatedAt

`func (o *Sandbox) HasBackupCreatedAt() bool`

HasBackupCreatedAt returns a boolean if a field has been set.

### GetAutoStopInterval

`func (o *Sandbox) GetAutoStopInterval() float32`

GetAutoStopInterval returns the AutoStopInterval field if non-nil, zero value otherwise.

### GetAutoStopIntervalOk

`func (o *Sandbox) GetAutoStopIntervalOk() (*float32, bool)`

GetAutoStopIntervalOk returns a tuple with the AutoStopInterval field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAutoStopInterval

`func (o *Sandbox) SetAutoStopInterval(v float32)`

SetAutoStopInterval sets AutoStopInterval field to given value.

### HasAutoStopInterval

`func (o *Sandbox) HasAutoStopInterval() bool`

HasAutoStopInterval returns a boolean if a field has been set.

### GetAutoArchiveInterval

`func (o *Sandbox) GetAutoArchiveInterval() float32`

GetAutoArchiveInterval returns the AutoArchiveInterval field if non-nil, zero value otherwise.

### GetAutoArchiveIntervalOk

`func (o *Sandbox) GetAutoArchiveIntervalOk() (*float32, bool)`

GetAutoArchiveIntervalOk returns a tuple with the AutoArchiveInterval field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAutoArchiveInterval

`func (o *Sandbox) SetAutoArchiveInterval(v float32)`

SetAutoArchiveInterval sets AutoArchiveInterval field to given value.

### HasAutoArchiveInterval

`func (o *Sandbox) HasAutoArchiveInterval() bool`

HasAutoArchiveInterval returns a boolean if a field has been set.

### GetExecutorDomain

`func (o *Sandbox) GetExecutorDomain() string`

GetExecutorDomain returns the ExecutorDomain field if non-nil, zero value otherwise.

### GetExecutorDomainOk

`func (o *Sandbox) GetExecutorDomainOk() (*string, bool)`

GetExecutorDomainOk returns a tuple with the ExecutorDomain field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetExecutorDomain

`func (o *Sandbox) SetExecutorDomain(v string)`

SetExecutorDomain sets ExecutorDomain field to given value.

### HasExecutorDomain

`func (o *Sandbox) HasExecutorDomain() bool`

HasExecutorDomain returns a boolean if a field has been set.

### GetBuckets

`func (o *Sandbox) GetBuckets() []SandboxBucket`

GetBuckets returns the Buckets field if non-nil, zero value otherwise.

### GetBucketsOk

`func (o *Sandbox) GetBucketsOk() (*[]SandboxBucket, bool)`

GetBucketsOk returns a tuple with the Buckets field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBuckets

`func (o *Sandbox) SetBuckets(v []SandboxBucket)`

SetBuckets sets Buckets field to given value.

### HasBuckets

`func (o *Sandbox) HasBuckets() bool`

HasBuckets returns a boolean if a field has been set.

### GetBuildInfo

`func (o *Sandbox) GetBuildInfo() BuildInfo`

GetBuildInfo returns the BuildInfo field if non-nil, zero value otherwise.

### GetBuildInfoOk

`func (o *Sandbox) GetBuildInfoOk() (*BuildInfo, bool)`

GetBuildInfoOk returns a tuple with the BuildInfo field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBuildInfo

`func (o *Sandbox) SetBuildInfo(v BuildInfo)`

SetBuildInfo sets BuildInfo field to given value.

### HasBuildInfo

`func (o *Sandbox) HasBuildInfo() bool`

HasBuildInfo returns a boolean if a field has been set.

### GetCreatedAt

`func (o *Sandbox) GetCreatedAt() string`

GetCreatedAt returns the CreatedAt field if non-nil, zero value otherwise.

### GetCreatedAtOk

`func (o *Sandbox) GetCreatedAtOk() (*string, bool)`

GetCreatedAtOk returns a tuple with the CreatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCreatedAt

`func (o *Sandbox) SetCreatedAt(v string)`

SetCreatedAt sets CreatedAt field to given value.

### HasCreatedAt

`func (o *Sandbox) HasCreatedAt() bool`

HasCreatedAt returns a boolean if a field has been set.

### GetUpdatedAt

`func (o *Sandbox) GetUpdatedAt() string`

GetUpdatedAt returns the UpdatedAt field if non-nil, zero value otherwise.

### GetUpdatedAtOk

`func (o *Sandbox) GetUpdatedAtOk() (*string, bool)`

GetUpdatedAtOk returns a tuple with the UpdatedAt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUpdatedAt

`func (o *Sandbox) SetUpdatedAt(v string)`

SetUpdatedAt sets UpdatedAt field to given value.

### HasUpdatedAt

`func (o *Sandbox) HasUpdatedAt() bool`

HasUpdatedAt returns a boolean if a field has been set.

### GetClass

`func (o *Sandbox) GetClass() string`

GetClass returns the Class field if non-nil, zero value otherwise.

### GetClassOk

`func (o *Sandbox) GetClassOk() (*string, bool)`

GetClassOk returns a tuple with the Class field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetClass

`func (o *Sandbox) SetClass(v string)`

SetClass sets Class field to given value.

### HasClass

`func (o *Sandbox) HasClass() bool`

HasClass returns a boolean if a field has been set.

### GetDaemonVersion

`func (o *Sandbox) GetDaemonVersion() string`

GetDaemonVersion returns the DaemonVersion field if non-nil, zero value otherwise.

### GetDaemonVersionOk

`func (o *Sandbox) GetDaemonVersionOk() (*string, bool)`

GetDaemonVersionOk returns a tuple with the DaemonVersion field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDaemonVersion

`func (o *Sandbox) SetDaemonVersion(v string)`

SetDaemonVersion sets DaemonVersion field to given value.

### HasDaemonVersion

`func (o *Sandbox) HasDaemonVersion() bool`

HasDaemonVersion returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


