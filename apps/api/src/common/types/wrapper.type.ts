/**
 * Wrapper type used to circumvent ESM modules circular dependency issue
 * caused by reflection metadata saving the type of the property.
 * This is equivalent to TypeORM's Relation<T> type but for service dependencies.
 */
export type WrapperType<T> = T;
