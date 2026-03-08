import { ExtractDocumentTypeFromTypedRxJsonSchema, toTypedRxJsonSchema } from 'rxdb';

export const contentSchemaLiteral = {
    title: 'content schema',
    description: 'Stores movies, tv shows, and people with flexible list assignments',
    version: 0,
    primaryKey: 'id', // We will generate a unique ID, e.g., 'movie_1399' to prevent collisions between TV and Movies
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100 // RxDB requires maxLength on primary keys
        },
        tmdbId: {
            type: 'number'
        },
        mediaType: {
            type: 'string',
            enum: ['movie', 'tv', 'person']
        },
        lists: {
            type: 'array',
            description: 'Array of list identifiers this item belongs to (e.g., ["watchlist"], ["watched", "favorites"])',
            items: {
                type: 'string'
            }
        },
        addedAt: {
            type: 'string',
            format: 'date-time'
        },
        watchedAt: {
            type: 'string',
            format: 'date-time'
        },
        // We will store the raw TMDB DTO here so we don't have to map individual fields
        payload: {
            type: 'object'
        }
    },
    required: ['id', 'tmdbId', 'mediaType', 'lists', 'addedAt', 'payload'],
    indexes: ['lists', 'addedAt'] // Indexes allow lightning-fast queries like "Find all where lists contains 'watchlist' sorted by addedAt"
} as const;

const schemaTyped = toTypedRxJsonSchema(contentSchemaLiteral);
export type ContentDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped>;
export const contentSchema = contentSchemaLiteral;
