import { ExtractDocumentTypeFromTypedRxJsonSchema, toTypedRxJsonSchema, RxJsonSchema, MigrationStrategies } from 'rxdb';

export const tvProgressSchemaLiteral = {
    title: 'tv progress schema',
    description: 'Tracks user progress for TV series, seasons, and episodes with 1-doc-per-series architecture',
    version: 1,
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
        seasonEpisodeCounts: {
            type: 'array',
            description: 'Regular episode counts by season, excluding specials',
            items: {
                type: 'object',
                properties: {
                    seasonNumber: { type: 'number', minimum: 1 },
                    episodeCount: { type: 'number', minimum: 0 }
                },
                required: ['seasonNumber', 'episodeCount']
            }
        },
        isMarkedComplete: {
            type: 'boolean'
        },
        unwatchedEpisodes: {
            type: 'array',
            description: 'Episode exceptions when the user marked an entire series Watched',
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
interface TvProgressMigrationInput {
    watchedEpisodes?: unknown;
    isMarkedComplete?: unknown;
    totalEpisodes?: unknown;
    unwatchedEpisodes?: unknown;
}

export const migrateTvProgressCounts = <T extends TvProgressMigrationInput>(
    oldDoc: T
): T & { watchedEpisodesCount: number } => {
    if (oldDoc.isMarkedComplete === true) {
        const exceptions = Array.isArray(oldDoc.unwatchedEpisodes)
            ? new Set(oldDoc.unwatchedEpisodes.filter(
                (episode): episode is string => typeof episode === 'string' && /^s[1-9]\d*e[1-9]\d*$/i.test(episode)
            ))
            : new Set<string>();
        const totalEpisodes = typeof oldDoc.totalEpisodes === 'number' ? oldDoc.totalEpisodes : 0;
        return {
            ...oldDoc,
            watchedEpisodesCount: Math.max(0, totalEpisodes - exceptions.size)
        };
    }

    const episodes = Array.isArray(oldDoc['watchedEpisodes'])
        ? oldDoc['watchedEpisodes'].filter((episode): episode is string => typeof episode === 'string')
        : [];
    const regularEpisodes = new Set(episodes.filter((episode) => /^s[1-9]\d*e[1-9]\d*$/i.test(episode)));
    return {
        ...oldDoc,
        watchedEpisodesCount: regularEpisodes.size
    };
};

export const tvProgressMigrationStrategies: MigrationStrategies = {
    1: (oldDoc: Record<string, unknown>) => migrateTvProgressCounts(oldDoc)
};
