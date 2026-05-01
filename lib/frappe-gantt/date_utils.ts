import type { DateScale, ParsedDuration } from './types';

const YEAR: DateScale = 'year';
const MONTH: DateScale = 'month';
const DAY: DateScale = 'day';
const HOUR: DateScale = 'hour';
const MINUTE: DateScale = 'minute';
const SECOND: DateScale = 'second';
const MILLISECOND: DateScale = 'millisecond';

function padStart(
    str: string | number,
    targetLength: number,
    padString?: string,
): string {
    str = str + '';
    targetLength = targetLength >> 0;
    padString = String(typeof padString !== 'undefined' ? padString : ' ');
    if (str.length > targetLength) {
        return String(str);
    }
    targetLength = targetLength - str.length;
    if (targetLength > padString.length) {
        padString += padString.repeat(targetLength / padString.length);
    }
    return padString.slice(0, targetLength) + String(str);
}

export interface DateUtils {
    parse_duration(duration: string): ParsedDuration | undefined;
    parse(
        date: Date | string,
        date_separator?: string,
        time_separator?: string | RegExp,
    ): Date;
    to_string(date: Date, with_time?: boolean): string;
    format(
        date: Date,
        date_format?: string,
        lang?: string,
    ): string;
    diff(date_a: Date, date_b: Date, scale?: string): number;
    today(): Date;
    now(): Date;
    add(date: Date, qty: number | string, scale: DateScale): Date;
    start_of(date: Date, scale: DateScale): Date;
    clone(date: Date): Date;
    get_date_values(date: Date): number[];
    convert_scales(period: string, to_scale: DateScale): number;
    get_days_in_month(date: Date): number;
    get_days_in_year(date: Date): number;
}

const date_utils: DateUtils = {
    parse_duration(duration: string): ParsedDuration | undefined {
        const regex = /([0-9]+)(y|m|d|h|min|s|ms)/gm;
        const matches = regex.exec(duration);
        if (matches !== null) {
            if (matches[2] === 'y') {
                return { duration: parseInt(matches[1], 10), scale: 'year' };
            }
            if (matches[2] === 'm') {
                return { duration: parseInt(matches[1], 10), scale: 'month' };
            }
            if (matches[2] === 'd') {
                return { duration: parseInt(matches[1], 10), scale: 'day' };
            }
            if (matches[2] === 'h') {
                return { duration: parseInt(matches[1], 10), scale: 'hour' };
            }
            if (matches[2] === 'min') {
                return {
                    duration: parseInt(matches[1], 10),
                    scale: 'minute',
                };
            }
            if (matches[2] === 's') {
                return { duration: parseInt(matches[1], 10), scale: 'second' };
            }
            if (matches[2] === 'ms') {
                return {
                    duration: parseInt(matches[1], 10),
                    scale: 'millisecond',
                };
            }
        }
        return undefined;
    },

    parse(
        date: Date | string,
        date_separator = '-',
        time_separator: string | RegExp = /[.:]/,
    ): Date {
        if (date instanceof Date) {
            return date;
        }
        if (typeof date === 'string') {
            const parts = date.split(' ');
            const date_parts = parts[0]
                .split(date_separator)
                .map((val) => parseInt(val, 10));
            const time_parts =
                parts[1] &&
                (typeof time_separator === 'string'
                    ? parts[1].split(time_separator)
                    : parts[1].split(time_separator));

            date_parts[1] = date_parts[1] ? date_parts[1] - 1 : 0;

            let vals: number[] = date_parts;

            if (time_parts && time_parts.length) {
                const tp = [...time_parts] as (string | number)[];
                if (tp.length === 4) {
                    tp[3] = '0.' + tp[3];
                    tp[3] = parseFloat(String(tp[3])) * 1000;
                }
                vals = vals.concat(tp as number[]);
            }
            return new Date(
                vals[0],
                vals[1],
                vals[2],
                vals[3] ?? 0,
                vals[4] ?? 0,
                vals[5] ?? 0,
                vals[6] ?? 0,
            );
        }
        throw new TypeError('date_utils.parse: expected Date or string');
    },

    to_string(date: Date, with_time = false): string {
        if (!(date instanceof Date)) {
            throw new TypeError('Invalid argument type');
        }
        const vals = this.get_date_values(date).map((val: number, i: number) => {
            if (i === 1) {
                val = val + 1;
            }
            if (i === 6) {
                return padStart(val + '', 3, '0');
            }
            return padStart(val + '', 2, '0');
        });
        const date_string = `${vals[0]}-${vals[1]}-${vals[2]}`;
        const time_string = `${vals[3]}:${vals[4]}:${vals[5]}.${vals[6]}`;

        return date_string + (with_time ? ' ' + time_string : '');
    },

    format(
        date: Date,
        date_format = 'YYYY-MM-DD HH:mm:ss.SSS',
        lang = 'en',
    ): string {
        const dateTimeFormat = new Intl.DateTimeFormat(lang, {
            month: 'long',
        });
        const dateTimeFormatShort = new Intl.DateTimeFormat(lang, {
            month: 'short',
        });
        const month_name = dateTimeFormat.format(date);
        const month_name_capitalized =
            month_name.charAt(0).toUpperCase() + month_name.slice(1);

        const values = this.get_date_values(date).map((d: number) =>
            padStart(d, 2, '0'),
        );
        const format_map: Record<string, string | number> = {
            YYYY: values[0],
            MM: padStart(+values[1] + 1, 2, '0'),
            DD: values[2],
            HH: values[3],
            mm: values[4],
            ss: values[5],
            SSS: values[6],
            D: values[2],
            MMMM: month_name_capitalized,
            MMM: dateTimeFormatShort.format(date),
        };

        let str = date_format;
        const formatted_values: (string | number)[] = [];

        Object.keys(format_map)
            .sort((a, b) => b.length - a.length)
            .forEach((key) => {
                if (str.includes(key)) {
                    str = str.replaceAll(key, `$${formatted_values.length}`);
                    formatted_values.push(format_map[key]);
                }
            });

        formatted_values.forEach((value, i) => {
            str = str.replaceAll(`$${i}`, String(value));
        });

        return str;
    },

    diff(date_a: Date, date_b: Date, scale = 'day'): number {
        let milliseconds: number;
        let seconds: number;
        let hours: number;
        let minutes: number;
        let days: number;
        let months: number;
        let years: number;

        milliseconds =
            date_a.getTime() -
            date_b.getTime() +
            (date_b.getTimezoneOffset() - date_a.getTimezoneOffset()) * 60000;
        seconds = milliseconds / 1000;
        minutes = seconds / 60;
        hours = minutes / 60;
        days = hours / 24;
        const yearDiff = date_a.getFullYear() - date_b.getFullYear();
        let monthDiff = date_a.getMonth() - date_b.getMonth();
        monthDiff += (days % 30) / 30;

        months = yearDiff * 12 + monthDiff;
        if (date_a.getDate() < date_b.getDate()) {
            months--;
        }

        years = months / 12;

        let scaleKey = scale;
        if (!scaleKey.endsWith('s')) {
            scaleKey += 's';
        }

        const buckets = {
            milliseconds,
            seconds,
            minutes,
            hours,
            days,
            months,
            years,
        };
        const v = buckets[scaleKey as keyof typeof buckets] ?? 0;
        return Math.round(v * 100) / 100;
    },

    today(): Date {
        const vals = this.get_date_values(new Date()).slice(0, 3);
        return new Date(vals[0], vals[1], vals[2]);
    },

    now(): Date {
        return new Date();
    },

    add(date: Date, qty: number | string, scale: DateScale): Date {
        const q = parseInt(String(qty), 10);
        const vals = [
            date.getFullYear() + (scale === YEAR ? q : 0),
            date.getMonth() + (scale === MONTH ? q : 0),
            date.getDate() + (scale === DAY ? q : 0),
            date.getHours() + (scale === HOUR ? q : 0),
            date.getMinutes() + (scale === MINUTE ? q : 0),
            date.getSeconds() + (scale === SECOND ? q : 0),
            date.getMilliseconds() + (scale === MILLISECOND ? q : 0),
        ];
        return new Date(
            vals[0],
            vals[1],
            vals[2],
            vals[3],
            vals[4],
            vals[5],
            vals[6],
        );
    },

    start_of(date: Date, scale: DateScale): Date {
        const scores: Record<DateScale, number> = {
            [YEAR]: 6,
            [MONTH]: 5,
            [DAY]: 4,
            [HOUR]: 3,
            [MINUTE]: 2,
            [SECOND]: 1,
            [MILLISECOND]: 0,
        };

        const should_reset = (_scale: DateScale): boolean => {
            const max_score = scores[scale];
            return scores[_scale] <= max_score;
        };

        const vals = [
            date.getFullYear(),
            should_reset(YEAR) ? 0 : date.getMonth(),
            should_reset(MONTH) ? 1 : date.getDate(),
            should_reset(DAY) ? 0 : date.getHours(),
            should_reset(HOUR) ? 0 : date.getMinutes(),
            should_reset(MINUTE) ? 0 : date.getSeconds(),
            should_reset(SECOND) ? 0 : date.getMilliseconds(),
        ];

        return new Date(
            vals[0],
            vals[1],
            vals[2],
            vals[3],
            vals[4],
            vals[5],
            vals[6],
        );
    },

    clone(date: Date): Date {
        const v = this.get_date_values(date);
        return new Date(v[0], v[1], v[2], v[3], v[4], v[5], v[6]);
    },

    get_date_values(date: Date): number[] {
        return [
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
            date.getSeconds(),
            date.getMilliseconds(),
        ];
    },

    convert_scales(period: string, to_scale: DateScale): number {
        const TO_DAYS: Record<DateScale, number> = {
            millisecond: 1 / 60 / 60 / 24 / 1000,
            second: 1 / 60 / 60 / 24,
            minute: 1 / 60 / 24,
            hour: 1 / 24,
            day: 1,
            month: 30,
            year: 365,
        };
        const parsed = this.parse_duration(period);
        if (!parsed) {
            return 0;
        }
        const { duration, scale } = parsed;
        const in_days = duration * TO_DAYS[scale as keyof typeof TO_DAYS];
        return in_days / TO_DAYS[to_scale];
    },

    get_days_in_month(date: Date): number {
        const no_of_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const month = date.getMonth();
        if (month !== 1) {
            return no_of_days[month];
        }
        const year = date.getFullYear();
        if ((year % 4 === 0 && year % 100 != 0) || year % 400 === 0) {
            return 29;
        }
        return 28;
    },

    get_days_in_year(date: Date): number {
        return date.getFullYear() % 4 ? 365 : 366;
    },
};

export default date_utils;
