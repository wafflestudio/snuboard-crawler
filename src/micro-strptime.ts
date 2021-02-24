/**
 * https://github.com/cho45/micro-strptime.js
 * (c) cho45 http://cho45.github.com/mit-license
 */

interface customDate extends Date {
    utcDay?: number;
    timezone?: number;
    AMPM?: string;
}

interface regex {
    format: string;
    handler: ((date: customDate, matched: string) => void) | null;
}

const fdMap = new Map(
    Object.entries({
        '%': <regex>{
            format: '%',
            handler: null,
        },
        a: <regex>{
            format: '[ㄱ-ㅎ|ㅏ-ㅣ|가-힣|\\w()]+',
            handler: null,
        },
        A: <regex>{
            format: '[a-z]+',
            handler: null,
        },
        b: <regex>{
            format: '[a-z]+',
            handler(date, matched) {
                const month = B.get(matched);
                if (month === undefined) throw Error('Failed to parse');
                date.setUTCMonth(month);
            },
        },
        B: <regex>{
            format: '[a-z]+',
            handler(date, matched) {
                const month = B.get(matched.slice(0, 3));
                if (month === undefined) throw Error('Failed to parse');
                date.setUTCMonth(month);
            },
        },
        Y: <regex>{
            format: '[0-9]{4}',
            handler(date, matched) {
                date.setUTCFullYear(+matched);
            },
        },
        m: <regex>{
            format: '[0-9]{0,2}',
            handler(date, matched) {
                date.setUTCMonth(+matched - 1);
            },
        },
        d: <regex>{
            format: '[0-9]{0,2}',
            handler(date, matched) {
                date.utcDay = +matched;
            },
        },
        H: <regex>{
            format: '[0-9]{0,2}',
            handler(date, matched) {
                date.setUTCHours(+matched);
            },
        },
        M: <regex>{
            format: '[0-9]{0,2}',
            handler(date, matched) {
                date.setUTCMinutes(+matched);
            },
        },
        S: <regex>{
            format: '[0-9]{0,2}',
            handler(date, matched) {
                date.setUTCSeconds(+matched);
            },
        },
        s: <regex>{
            format: '[0-9]+',
            handler(date, matched) {
                date.setUTCMilliseconds(+matched);
            },
        },
        z: <regex>{
            format: '[+-][0-9]{4}',
            handler(date, matched) {
                date.timezone = +matched.slice(0, 3) * (60 * 60) + +matched.slice(3, 5) * 60;
            },
        },
        Z: <regex>{
            format: 'UTC|Z|[+-][0-9][0-9]:?[0-9][0-9]',
            handler(date, matched) {
                if (matched === 'Z') return;
                if (matched === 'UTC') return;
                // '+09:00' or '+0900'
                matched = matched.replace(/:/, '');
                date.timezone = +matched.slice(0, 3) * (60 * 60) + +matched.slice(3, 5) * 60;
            },
        },
        I: <regex>{
            format: '[0-9]{0,2}',
            handler(date, matched) {
                date.setUTCHours(+matched);
            },
        },
        p: <regex>{
            format: '오전|오후',
            handler(date, matched) {
                date.AMPM = matched;
            },
        },
    }),
);

const B = new Map(
    Object.entries({
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11,
    }),
);

export function strptime(str: string, format: string, isKST = true): Date {
    if (!format) throw Error('Missing format');

    const ff: (((date: Date, matched: string) => void) | null)[] = [];
    const re = new RegExp(
        format.replace(/%(?:([a-zA-Z%])|('[^']+')|("[^"]+"))/g, function (_, a, b, c) {
            const fd = a || b || c;
            const d = fdMap.get(fd);
            if (d === undefined) throw Error(`Unknown format specifier: ${fd}`);
            ff.push(d.handler);
            return `(${d.format})`;
        }),
        'i',
    );
    const matched = str.match(re);
    if (!matched) throw Error('Failed to parse');

    let date = <customDate>new Date(0);
    for (let i = 0, len = ff.length; i < len; i++) {
        const fun = ff[i];
        if (fun) fun(date, matched[i + 1]);
    }
    if (date.utcDay) {
        date.setUTCDate(date.utcDay);
    }
    if (date.AMPM) {
        if (date.getUTCHours() === 12) date.setUTCHours(date.getUTCHours() - 12);
        if (date.AMPM === '오후') date.setUTCHours(date.getUTCHours() + 12);
    }
    if (date.timezone) {
        date = <customDate>new Date(date.getTime() - date.timezone * 1000);
    } else if (isKST) {
        date = <customDate>new Date(date.getTime() - 9 * 60 * 60 * 1000);
    }
    return date;
}
