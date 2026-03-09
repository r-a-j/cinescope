import { ExtractDocumentTypeFromTypedRxJsonSchema, MigrationStrategies, RxJsonSchema, toTypedRxJsonSchema } from 'rxdb';

export const settingsSchemaLiteral = {
    title: 'settings schema',
    description: 'Stores user application settings',
    version: 0,
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
        }
    },
    required: ['id', 'allowAdultContent', 'theme']
} as const;

export const settingsSchemaTyped = toTypedRxJsonSchema(settingsSchemaLiteral);
export type SettingsDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof settingsSchemaTyped>;
export const settingsSchema: RxJsonSchema<SettingsDocType> = settingsSchemaLiteral;
export const settingsMigrationStrategies: MigrationStrategies = {};