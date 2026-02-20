import { Injectable } from '@angular/core';
import { ContentModel } from '../models/content.model';

export type TimelineNodeType = 'single' | 'stacked';

export interface TimelineNode {
    date: string; // YYYY-MM-DD
    type: TimelineNodeType;
}

export interface SingleNode extends TimelineNode {
    type: 'single';
    item: ContentModel;
}

export interface StackedNode extends TimelineNode {
    type: 'stacked';
    items: ContentModel[];
}

@Injectable({
    providedIn: 'root'
})
export class TimelineService {
    generateTimeline(contents: ContentModel[]): TimelineNode[] {
        const grouped = new Map<string, ContentModel[]>();

        for (const item of contents) {
            if (!item.watchedAt) {
                item.watchedAt = '1970-01-01T00:00:00.000Z';
            }

            const dateKey = item.watchedAt.split('T')[0];

            if (!grouped.has(dateKey)) {
                grouped.set(dateKey, []);
            }
            grouped.get(dateKey)!.push(item);
        }

        const timelineNodes: TimelineNode[] = [];

        for (const [date, items] of Array.from(grouped.entries())) {
            timelineNodes.push({
                date,
                type: 'stacked',
                items
            } as StackedNode);
        }

        timelineNodes.sort((a, b) => b.date.localeCompare(a.date));

        return timelineNodes;
    }
}
