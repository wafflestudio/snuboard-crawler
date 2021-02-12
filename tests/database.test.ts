import { createDBConnection } from '../src/database';
import { Notice } from '../server/src/notice/notice.entity';

describe('connect to Database', () => {
    it('repo', async () => {
        const connection = await createDBConnection();
        expect(await connection.getRepository(Notice).count()).toBe(0);
        await connection.close();
    });
});
