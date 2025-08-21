import { OnEvent, type OnEventMetadata } from "@nestjs/event-emitter";

export function OnAsyncEvent({ event, options = {} }: OnEventMetadata): MethodDecorator {
  return OnEvent(event, {
    ...options,
    promisify: true,
    suppressErrors: false,
  });
}
