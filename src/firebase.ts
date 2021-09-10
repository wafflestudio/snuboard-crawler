import * as admin from 'firebase-admin';

import { fbConfig } from './fbconfig';
import { Department } from '../server/src/department/department.entity';
import { Notice } from '../server/src/notice/notice.entity';
import { parseTagsToStringWithSeparator } from './utils';
import { messaging } from 'firebase-admin';
import MessagingOptions = messaging.MessagingOptions;

admin.initializeApp({ credential: admin.credential.cert(fbConfig) });

export async function sendNoticeCreationMessage(
    condition: string,
    notice: Notice,
    department: Department,
    tags: string[],
) {
    const previewLength = 250;

    const payload = {
        data: {
            title: `${department.name} 신규 공지사항입니다`,
            body: notice.title,
            noticeId: `${notice.id}`,
            departmentName: department.name,
            departmentId: `${department.id}`,
            preview: notice.contentText.slice(0, previewLength),
            tags: parseTagsToStringWithSeparator(tags, ';'),
        },
    };
    const options: MessagingOptions = {
        contentAvailable: true,
    };

    await admin.messaging().sendToCondition(condition, payload, options);
}
