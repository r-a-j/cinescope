import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { text } = req.body as { text?: string };

        if (!text) {
            return res.status(400).json({ error: 'Text payload is required' });
        }

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            // Enterprise Upgrade: Force the AI to natively output a valid JSON array
            generationConfig: { responseMimeType: 'application/json' }
        });

        const prompt = `
            You are a movie extraction assistant. Read the following massive text compiled from several Instagram screenshots.
            Identify any valid movie or TV show titles across all the text.
            Ignore actor names, director names, years, and UI elements.
            Return ONLY a JSON array of strings containing the unique titles. Example: ["Inception", "Breaking Bad"]. 
            If you find nothing, return [].
            Text: "${text}"
        `;

        const result = await model.generateContent(prompt);
        const responseText: string = result.response.text().trim();

        // Safe JSON parsing because the MIME type is strictly enforced by the Google API
        return res.status(200).json(JSON.parse(responseText));

    } catch (error: unknown) {
        console.error('[Gemini API Error]', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}