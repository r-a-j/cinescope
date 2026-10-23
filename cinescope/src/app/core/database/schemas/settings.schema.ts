import { ExtractDocumentTypeFromTypedRxJsonSchema, MigrationStrategies, RxJsonSchema, toTypedRxJsonSchema } from 'rxdb';

export const settingsSchemaLiteral = {
    title: 'settings schema',
    description: 'Stores user application settings',
    version: 2,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 50 // e.g., 'user_preferences'
        },
        allowAdultContent: {
            type: 'boolean',
            default: false
        },
        theme: {
            type: 'string',
            enum: ['system', 'light', 'dark'],
            default: 'system'
        },
        region: {
            type: 'string',
            maxLength: 10,
            default: 'IN'
        },
        isManualRegion: {
            type: 'boolean',
            default: false
        }
    },
    required: ['id', 'allowAdultContent', 'theme', 'region']
} as const;

export const settingsSchemaTyped = toTypedRxJsonSchema(settingsSchemaLiteral);
export type SettingsDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof settingsSchemaTyped>;
export const settingsSchema: RxJsonSchema<SettingsDocType> = settingsSchemaLiteral;
export const settingsMigrationStrategies: MigrationStrategies = {
    1: (oldDoc: Record<string, unknown>) => {
        const rawRegion = typeof oldDoc['region'] === 'string' && (oldDoc['region'] as string).trim().length > 0
            ? (oldDoc['region'] as string).trim().toUpperCase()
            : 'IN';
        return {
            ...oldDoc,
            region: rawRegion
        };
    },
    2: (oldDoc: Record<string, unknown>) => {
        return {
            ...oldDoc,
            isManualRegion: Boolean(oldDoc['isManualRegion'])
        };
    }
};
