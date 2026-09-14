import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedGamesWithFilters(db: Database): Promise<void> {
    const [strategy] = await db.insert(categories).values({ name: 'Strategy', description: 'cat' }).returning({ id: categories.id });
    const [racing] = await db.insert(categories).values({ name: 'Racing', description: 'cat' }).returning({ id: categories.id });
    const [nova] = await db.insert(publishers).values({ name: 'Nova Games', description: 'pub' }).returning({ id: publishers.id });
    const [peak] = await db.insert(publishers).values({ name: 'Peak Publishing', description: 'pub' }).returning({ id: publishers.id });

    await db.insert(games).values([
        { title: 'Apex Circuit', description: 'Racing title', starRating: 4.7, categoryId: racing.id, publisherId: nova.id },
        { title: 'Crown Tactics', description: 'Strategy title', starRating: 4.2, categoryId: strategy.id, publisherId: peak.id },
        { title: 'Drift Syndicate', description: 'Racing title', starRating: 4.5, categoryId: racing.id, publisherId: peak.id },
        { title: 'Empire Fall', description: 'Strategy title', starRating: 4.1, categoryId: strategy.id, publisherId: nova.id },
    ]);
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters games by one or more categories', async () => {
        await seedGamesWithFilters(db);
        const categoriesList = await getAllCategories(db);
        const strategyId = categoriesList.find((category) => category.name === 'Strategy')?.id ?? 0;

        const matchingGames = await getAllGames(db, { categoryIds: [strategyId] });
        expect(matchingGames.map((game) => game.title)).toEqual(['Crown Tactics', 'Empire Fall']);
    });

    it('filters games by publisher', async () => {
        await seedGamesWithFilters(db);
        const publishersList = await getAllPublishers(db);
        const novaId = publishersList.find((publisher) => publisher.name === 'Nova Games')?.id ?? 0;

        const matchingGames = await getAllGames(db, { publisherId: novaId });
        expect(matchingGames.map((game) => game.title)).toEqual(['Apex Circuit', 'Empire Fall']);
    });

    it('combines category and publisher filters', async () => {
        await seedGamesWithFilters(db);
        const categoriesList = await getAllCategories(db);
        const publishersList = await getAllPublishers(db);
        const racingId = categoriesList.find((category) => category.name === 'Racing')?.id ?? 0;
        const peakId = publishersList.find((publisher) => publisher.name === 'Peak Publishing')?.id ?? 0;

        const matchingGames = await getAllGames(db, { categoryIds: [racingId], publisherId: peakId });
        expect(matchingGames.map((game) => game.title)).toEqual(['Drift Syndicate']);
    });
});
