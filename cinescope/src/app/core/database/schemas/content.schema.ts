import { ExtractDocumentTypeFromTypedRxJsonSchema, toTypedRxJsonSchema, RxJsonSchema, MigrationStrategies } from 'rxdb';

export const contentSchemaLiteral = {
    title: 'content schema',
    description: 'Stores movies, tv shows, and people with flexible list assignments',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100
        },
        tmdbId: {
            type: 'number'
        },
        mediaType: {
            type: 'string',
            enum: ['movie', 'tv', 'person'],
            maxLength: 10
        },
        lists: {
            type: 'array',
            description: 'Array of list identifiers this item belongs to',
            items: {
                type: 'string'
            }
        },
        addedAt: {
            type: 'string',
            format: 'date-time',
            maxLength: 30
        },
        watchedAt: {
            type: 'string',
            format: 'date-time'
        },
        payload: {
            type: 'object'
        }
    },
    required: ['id', 'tmdbId', 'mediaType', 'lists', 'addedAt', 'payload'],
    indexes: ['addedAt', 'mediaType']
} as const;

export const contentSchemaTyped = toTypedRxJsonSchema(contentSchemaLiteral);
export type ContentDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof contentSchemaTyped>;

export const contentSchema: RxJsonSchema<ContentDocType> = contentSchemaLiteral;
export const contentMigrationStrategies: MigrationStrategies = {};