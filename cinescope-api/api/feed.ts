import Parser from 'rss-parser';

// Configure the parser to look for custom data fields
const parser = new Parser({
    customFields: {
        item: ['description', 'content:encoded', 'enclosure'],
    },
    // Spoof a User-Agent to bypass bot protection from sites like Koimoi
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

export default async function handler(req, res) {
    // 1. CORS Headers (Crucial for local Angular dev and Ionic WebViews)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing RSS URL parameter' });
    }

    try {
        const feed = await parser.parseURL(url);

        // 2. Standardize the data and extract images on the server
        const items = feed.items.map(item => {
            let img = null;

            // Check for hidden enclosure images
            if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image/')) {
                img = item.enclosure.url;
            }

            // Check HTML content for image tags
            if (!img) {
                const htmlBlob = (item['content:encoded'] || '') + ' ' + (item.description || '');
                const match = htmlBlob.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (match) img = match[1];
                console.log('Image found:', img);
            }

            return {
                title: item.title,
                pubDate: item.isoDate || item.pubDate,
                link: item.link,
                sourceName: feed.title || 'Unknown',
                description: item.description,
                content: item['content:encoded'] || item.content,
                author: item.creator || item.author || 'Staff',
                extractedImage: img
            };
        });

        // 3. Return the exact JSON structure Angular is expecting
        return res.status(200).json({
            status: 'ok',
            feed: { title: feed.title, link: feed.link },
            items
        });

    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return res.status(500).json({ error: 'Failed to fetch or parse RSS feed' });
    }
}