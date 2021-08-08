import * as admin from 'firebase-admin';

import { fbConfig } from './fbconfig';
import { Department } from '../server/src/department/department.entity';
import { Notice } from '../server/src/notice/notice.entity';
import { parseTagsToStringWithSeparator } from './utils';

admin.initializeApp({ credential: admin.credential.cert(fbConfig) });

export async function sendNoticeCreationMessage(
    condition: string,
    notice: Notice,
    department: Department,
    tags: string[],
) {
    const previewLength = 250;

    const message = {
        data: {
            title: `${department.name} 신규 공지사항입니다`,
            body: notice.title,
            noticeId: `${notice.id}`,
            departmentName: department.name,
            preview: notice.contentText.slice(0, previewLength),
            tags: parseTagsToStringWithSeparator(tags, ';'),
        },
        condition,
    };
    await admin.messaging().send(message);
}
