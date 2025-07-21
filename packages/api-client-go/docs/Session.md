# Session

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**SessionId** | **string** | The ID of the session | 
**Commands** | [**[]Command**](Command.md) | The list of commands executed in this session | 

## Methods

### NewSession

`func NewSession(sessionId string, commands []Command, ) *Session`

NewSession instantiates a new Session object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSessionWithDefaults

`func NewSessionWithDefaults() *Session`

NewSessionWithDefaults instantiates a new Session object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSessionId

`func (o *Session) GetSessionId() string`

GetSessionId returns the SessionId field if non-nil, zero value otherwise.

### GetSessionIdOk

`func (o *Session) GetSessionIdOk() (*string, bool)`

GetSessionIdOk returns a tuple with the SessionId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSessionId

`func (o *Session) SetSessionId(v string)`

SetSessionId sets SessionId field to given value.


### GetCommands

`func (o *Session) GetCommands() []Command`

GetCommands returns the Commands field if non-nil, zero value otherwise.

### GetCommandsOk

`func (o *Session) GetCommandsOk() (*[]Command, bool)`

GetCommandsOk returns a tuple with the Commands field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCommands

`func (o *Session) SetCommands(v []Command)`

SetCommands sets Commands field to given value.


### SetCommandsNil

`func (o *Session) SetCommandsNil(b bool)`

 SetCommandsNil sets the value for Commands to be an explicit nil

### UnsetCommands
`func (o *Session) UnsetCommands()`

UnsetCommands ensures that no value is present for Commands, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


