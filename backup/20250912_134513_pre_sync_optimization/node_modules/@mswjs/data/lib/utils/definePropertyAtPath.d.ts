/**
 * Abstraction over `Object.defineProperty` that supports
 * property paths (nested properties).
 *
 * @example
 * const target = {}
 * definePropertyAtPath(target, 'a.b.c', { get(): { return 2 }})
 * console.log(target.a.b.c) // 2
 */
export declare function definePropertyAtPath<AttributesType extends PropertyDescriptor>(target: Record<string, unknown>, propertyPath: string[], attributes: AttributesType): void;
