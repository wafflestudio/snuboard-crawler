import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin/lib/credential';

import config from '../fbconfig.json';
import { Department } from '../server/src/department/department.entity';
import { Notice } from '../server/src/notice/notice.entity';
import { StringKey } from './types/custom-types';

admin.initializeApp({ credential: admin.credential.cert(<ServiceAccount>config) });

export async function sendNoticeCreationMessage(tag: string, notice: Notice, department: Department) {
    const message = {
        data: {
            title: `${department.name} 신규 공지사항입니다`,
            body: notice.title,
        },
        topic: encodeTopic(tag, department),
    };
    console.log(await admin.messaging().send(message));
}

function encodeTopic(tag: string, department: Department) {
    const rawTopic = `${department.name}/${tag}`;
    const replacement: StringKey = { '+': '-', '/': '_', '=': '%' };
    return Buffer.from(rawTopic)
        .toString('base64')
        .replace(/[+/=]/g, (str) => {
            return replacement[str];
        });
}
