import { ExtractDocumentTypeFromTypedRxJsonSchema, toTypedRxJsonSchema, RxJsonSchema, MigrationStrategies } from 'rxdb';

export const tvProgressSchemaLiteral = {
    title: 'tv progress schema',
    description: 'Tracks user progress for TV series, seasons, and episodes with 1-doc-per-series architecture',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 50
        },
        tmdbId: {
            type: 'number',
            multipleOf: 1,
            minimum: 1,
            maximum: 1000000000
        },
        seriesTitle: {
            type: 'string',
            maxLength: 300
        },
        posterPath: {
            type: 'string'
        },
        backdropPath: {
            type: 'string'
        },
        totalSeasons: {
            type: 'number'
        },
        totalEpisodes: {
            type: 'number'
        },
        watchedEpisodesCount: {
            type: 'number'
        },
        lastWatchedSeason: {
            type: 'number'
        },
        lastWatchedEpisode: {
            type: 'number'
        },
        lastWatchedEpisodeTitle: {
            type: 'string'
        },
        lastWatchedAt: {
            type: 'number'
        },
        watchedEpisodes: {
            type: 'array',
            description: 'Compact keys representing watched episodes e.g. ["s1e1", "s1e2", "s2e1"]',
            items: {
                type: 'string'
            }
        },
        status: {
            type: 'string'
        },
        nextAirDate: {
            type: 'string'
        },
        nextAirSeason: {
            type: 'number'
        },
        nextAirEpisode: {
            type: 'number'
        },
        nextAirEpisodeTitle: {
            type: 'string'
        },
        updatedAt: {
            type: 'number',
            multipleOf: 1,
            minimum: 0,
            maximum: 10000000000000000
        }
    },
    required: ['id', 'tmdbId', 'seriesTitle', 'totalSeasons', 'totalEpisodes', 'watchedEpisodesCount', 'watchedEpisodes', 'updatedAt'],
    indexes: ['tmdbId', 'updatedAt']
} as const;

export const tvProgressSchemaTyped = toTypedRxJsonSchema(tvProgressSchemaLiteral);
export type TvProgressDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof tvProgressSchemaTyped>;

export const tvProgressSchema: RxJsonSchema<TvProgressDocType> = tvProgressSchemaLiteral;
export const tvProgressMigrationStrategies: MigrationStrategies = {};
