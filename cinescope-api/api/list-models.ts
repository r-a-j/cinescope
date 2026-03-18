import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        
        let models = [];
        if (data && data.models) {
            models = data.models.map((m: any) => ({
                name: m.name,
                displayName: m.displayName
            }));
        }
        res.status(200).json({ models });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
