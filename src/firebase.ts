import * as admin from 'firebase-admin';
import { messaging } from 'firebase-admin';

import { fbConfig } from '../server/src/fbconfig.js';
import { parseTagsToStringWithSeparator } from './utils.js';
import { Department } from '../server/src/department/department.entity.js';
import { Notice } from '../server/src/notice/notice.entity.js';

import MessagingOptions = messaging.MessagingOptions;
import { cert, initializeApp } from 'firebase-admin/app';

initializeApp({ credential: admin.credential.applicationDefault() });

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
