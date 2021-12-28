import * as admin from 'firebase-admin';

import { fbConfig } from './fbconfig';
import { Department } from '../server/src/department/department.entity';
import { Notice } from '../server/src/notice/notice.entity';
import { parseTagsToStringWithSeparator } from './utils';
// import MessagingOptions = messaging.MessagingOptions;
// import TokenMessage = messaging.TokenMessage;

admin.initializeApp({ credential: admin.credential.cert(fbConfig) });

const getPayload = (notice: Notice, department: Department, tags: string[]) => {
    const previewLength = 250;

    return {
        title: `${department.name} 신규 공지사항입니다`,
        body: notice.title,
        noticeId: `${notice.id}`,
        departmentName: department.name,
        departmentId: `${department.id}`,
        preview: notice.contentText.slice(0, previewLength),
        tags: parseTagsToStringWithSeparator(tags, ';'),
    };
};

export async function sendNoticeCreationMessage(
    condition: string,
    notice: Notice,
    department: Department,
    tags: string[],
) {
    const testMessage = {
        android: {
            data: getPayload(notice, department, tags),
        },
        apns: {
            payload: {
                aps: {
                    alert: getPayload(notice, department, tags),
                    contentAvailable: true,
                },
                customKey: 'customValue',
            },
        },
        condition,
    };
    await admin.messaging().send(testMessage);
}
