import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin/lib/credential';

import { fbConfig } from './fbconfig';
import { Department } from '../server/src/department/department.entity';
import { Notice } from '../server/src/notice/notice.entity';

admin.initializeApp({ credential: admin.credential.cert(fbConfig) });

export async function sendNoticeCreationMessage(condition: string, notice: Notice, department: Department) {
    const message = {
        data: {
            title: `${department.name} 신규 공지사항입니다`,
            body: notice.title,
            noticeId: `${notice.id}`,
        },
        condition,
    };
    await admin.messaging().send(message);
}
