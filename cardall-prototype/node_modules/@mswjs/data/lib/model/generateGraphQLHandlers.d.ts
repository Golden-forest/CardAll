import { GraphQLSchema, GraphQLFieldConfigMap, GraphQLInputObjectType, GraphQLInputFieldConfigMap, GraphQLScalarType } from 'graphql';
import { GraphQLHandler } from 'msw';
import { ModelAPI, ModelDefinition, ModelDictionary } from '../glossary';
interface GraphQLFieldsMap {
    fields: GraphQLFieldConfigMap<any, any>;
    inputFields: GraphQLInputFieldConfigMap;
    queryInputFields: GraphQLInputFieldConfigMap;
}
/**
 * Derive a GraphQL scalar type from a variable.
 */
export declare function getGraphQLType(value: any): GraphQLScalarType<number, number> | GraphQLScalarType<boolean, boolean> | GraphQLScalarType<string, string>;
export declare const comparatorTypes: {
    IdQueryType: GraphQLInputObjectType;
    StringQueryType: GraphQLInputObjectType;
    IntQueryType: GraphQLInputObjectType;
    BooleanQueryType: GraphQLInputObjectType;
};
export declare function getQueryTypeByValueType(valueType: GraphQLScalarType): GraphQLInputObjectType;
export declare function definitionToFields(definition: ModelDefinition): GraphQLFieldsMap;
export declare function generateGraphQLSchema<Dictionary extends ModelDictionary, ModelName extends string>(modelName: ModelName, definition: ModelDefinition, model: ModelAPI<Dictionary, ModelName>): GraphQLSchema;
export declare function generateGraphQLHandlers<Dictionary extends ModelDictionary, ModelName extends string>(modelName: ModelName, definition: ModelDefinition, model: ModelAPI<Dictionary, ModelName>, baseUrl?: string): GraphQLHandler[];
export {};
