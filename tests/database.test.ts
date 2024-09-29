import { Notice } from '../server/src/notice/notice.entity.js';
import { getDataSource } from '../src/database.js';

describe('connect to Database', () => {
    it('repo', async () => {
        expect(await (await getDataSource()).getRepository(Notice).count()).toBe(0);
    });
});

afterAll(async () => {
    await (await getDataSource()).destroy();
});
