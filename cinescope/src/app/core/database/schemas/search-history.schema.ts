import { ExtractDocumentTypeFromTypedRxJsonSchema, toTypedRxJsonSchema, RxJsonSchema, MigrationStrategies } from 'rxdb';

export const searchHistorySchemaLiteral = {
    title: 'search history schema',
    description: 'Stores recent search queries for autocompletion and history',
    version: 0,
    primaryKey: 'query',
    type: 'object',
    properties: {
        query: {
            type: 'string',
            maxLength: 100
        },
        timestamp: {
            type: 'number',
            multipleOf: 1,
            minimum: 0,
            maximum: 10000000000000000
        }
    },
    required: ['query', 'timestamp'],
    // Use timestamp as an index so we can easily sort by most recent searches
    indexes: ['timestamp']
} as const;

export const searchHistorySchemaTyped = toTypedRxJsonSchema(searchHistorySchemaLiteral);
export type SearchHistoryDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof searchHistorySchemaTyped>;

export const searchHistorySchema: RxJsonSchema<SearchHistoryDocType> = searchHistorySchemaLiteral;
export const searchHistoryMigrationStrategies: MigrationStrategies = {};
