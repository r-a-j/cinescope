import {
    OpenAPIRegistry,
    OpenApiGeneratorV3,
    extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

extendZodWithOpenApi(z);
const registry = new OpenAPIRegistry();

// --- 1. Define Authentication ---
const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Used for the TMDB Proxy endpoint. Pass your TMDB Access Token.',
});

// --- 2. Define Shared Headers ---
const ClientHeader = z.string().openapi({
    description: 'Must be exactly: CS-Mobile-App-2026',
    example: 'CS-Mobile-App-2026',
});

// --- 3. Route: /api/extract ---
registry.registerPath({
    method: 'post',
    path: '/api/extract',
    description: 'Extracts movie titles from raw OCR text using Gemini 2.5 Flash.',
    summary: 'Extract Movie Titles',
    request: {
        headers: z.object({ 'x-cinescope-client': ClientHeader }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        text: z.string().openapi({ example: 'I watched Inception and Breaking Bad today.' }),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'A JSON array of extracted movie titles.',
            content: {
                'application/json': {
                    schema: z.array(z.string()).openapi({ example: ['Inception', 'Breaking Bad'] }),
                },
            },
        },
        400: { description: 'Bad Request - Missing text payload' },
        403: { description: 'Forbidden - Invalid Client Origin' },
    },
});

// --- 4. Route: /api/smart-search ---
registry.registerPath({
    method: 'post',
    path: '/api/smart-search',
    description: 'Executes a semantic search query using the Gemini fallback orchestrator.',
    summary: 'AI Smart Search',
    request: {
        headers: z.object({ 'x-cinescope-client': ClientHeader }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        query: z.string().openapi({ example: 'movies about space travel with matthew mcconaughey' }),
                        models: z.array(z.string()).optional().openapi({ example: ['gemini-3.1-flash-lite-preview'] }),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'An Execution Graph of sections to query against TMDB.',
            content: {
                'application/json': {
                    schema: z.object({
                        sections: z.array(z.any()), // You can strictly type this later based on your schema
                    }),
                },
            },
        },
        429: { description: 'Too Many Requests - AI Quota Exceeded' },
    },
});

// --- 5. Generate the JSON ---
const generator = new OpenApiGeneratorV3(registry.definitions);
const document = generator.generateDocument({
    openapi: '3.0.0',
    info: {
        version: '1.0.0',
        title: 'Cinescope Serverless API',
        description: 'Internal API routes for the Cinescope mobile application.',
    },
    servers: [{ url: 'https://api.cinescope.app' }],
});

// Write it to the Docusaurus workspace!
const outputPath = path.resolve(__dirname, '../docs/cinescope-openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
console.log(`✅ OpenAPI spec generated at ${outputPath}`);