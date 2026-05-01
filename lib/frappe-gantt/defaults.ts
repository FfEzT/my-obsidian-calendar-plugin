import date_utils from './date_utils';
import type {
    GanttChartLike,
    GanttOptions,
    GanttTaskInternal,
    PopupFactory,
    ViewMode,
} from './types';

function getDecade(d: Date): string {
    const year = d.getFullYear();
    return year - (year % 10) + '';
}

function formatWeek(d: Date, ld: Date | null, lang: string): string {
    const endOfWeek = date_utils.add(d, 6, 'day');
    const endFormat =
        endOfWeek.getMonth() !== d.getMonth() ? 'D MMM' : 'D';
    const beginFormat =
        !ld || d.getMonth() !== ld.getMonth() ? 'D MMM' : 'D';
    return `${date_utils.format(d, beginFormat, lang)} - ${date_utils.format(endOfWeek, endFormat, lang)}`;
}

const DEFAULT_VIEW_MODES: ViewMode[] = [
    {
        name: 'Hour',
        padding: '7d',
        step: '1h',
        date_format: 'YYYY-MM-DD HH:',
        lower_text: 'HH',
        upper_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? date_utils.format(d, 'D MMMM', lang)
                : '',
        upper_text_frequency: 24,
    },
    {
        name: 'Quarter Day',
        padding: '7d',
        step: '6h',
        date_format: 'YYYY-MM-DD HH:',
        lower_text: 'HH',
        upper_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? date_utils.format(d, 'D MMM', lang)
                : '',
        upper_text_frequency: 4,
    },
    {
        name: 'Half Day',
        padding: '14d',
        step: '12h',
        date_format: 'YYYY-MM-DD HH:',
        lower_text: 'HH',
        upper_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? !ld || d.getMonth() !== ld.getMonth()
                    ? date_utils.format(d, 'D MMM', lang)
                    : date_utils.format(d, 'D', lang)
                : '',
        upper_text_frequency: 2,
    },
    {
        name: 'Day',
        padding: '7d',
        date_format: 'YYYY-MM-DD',
        step: '1d',
        lower_text: (d, ld, lang) =>
            !ld || d.getDate() !== ld.getDate()
                ? date_utils.format(d, 'D', lang)
                : '',
        upper_text: (d, ld, lang) =>
            !ld || d.getMonth() !== ld.getMonth()
                ? date_utils.format(d, 'MMMM', lang)
                : '',
        thick_line: (d) => d.getDay() === 1,
    },
    {
        name: 'Week',
        padding: '1m',
        step: '7d',
        date_format: 'YYYY-MM-DD',
        column_width: 140,
        lower_text: formatWeek,
        upper_text: (d, ld, lang) =>
            !ld || d.getMonth() !== ld.getMonth()
                ? date_utils.format(d, 'MMMM', lang)
                : '',
        thick_line: (d) => d.getDate() >= 1 && d.getDate() <= 7,
        upper_text_frequency: 4,
    },
    {
        name: 'Month',
        padding: '2m',
        step: '1m',
        column_width: 120,
        date_format: 'YYYY-MM',
        lower_text: 'MMMM',
        upper_text: (d, ld, lang) =>
            !ld || d.getFullYear() !== ld.getFullYear()
                ? date_utils.format(d, 'YYYY', lang)
                : '',
        thick_line: (d) => d.getMonth() % 3 === 0,
        snap_at: '7d',
    },
    {
        name: 'Year',
        padding: '2y',
        step: '1y',
        column_width: 120,
        date_format: 'YYYY',
        upper_text: (d, ld) =>
            !ld || getDecade(d) !== getDecade(ld) ? getDecade(d) : '',
        lower_text: 'YYYY',
        snap_at: '30d',
    },
];

const defaultPopup: PopupFactory = (ctx) => {
    const task = ctx.task as GanttTaskInternal & {
        description?: string;
        actual_duration?: number;
        ignored_duration?: number;
    };
    const chart = ctx.chart as GanttChartLike;
    ctx.set_title(task.name);
    if (task.description) ctx.set_subtitle(task.description);
    else ctx.set_subtitle('');

    const start_date = date_utils.format(
        task._start,
        'MMM D',
        chart.options.language as string,
    );
    const end_date = date_utils.format(
        date_utils.add(task._end, -1, 'second'),
        'MMM D',
        chart.options.language as string,
    );

    const actual = task.actual_duration ?? 0;
    const ignored = task.ignored_duration ?? 0;
    ctx.set_details(
        `${start_date} - ${end_date} (${actual} days${ignored ? ' + ' + ignored + ' excluded' : ''})<br/>Progress: ${Math.floor((task.progress ?? 0) * 100) / 100}%`,
    );
};

const DEFAULT_OPTIONS: GanttOptions & {
    view_modes: ViewMode[];
} = {
    arrow_curve: 5,
    auto_move_label: false,
    bar_corner_radius: 3,
    bar_height: 30,
    container_height: 'auto',
    column_width: null,
    date_format: 'YYYY-MM-DD HH:mm',
    upper_header_height: 45,
    lower_header_height: 30,
    snap_at: null,
    infinite_padding: true,
    holidays: { 'var(--g-weekend-highlight-color)': 'weekend' },
    ignore: [],
    language: 'en',
    lines: 'both',
    move_dependencies: true,
    restrict_drag_by_dependencies: true,
    padding: 18,
    popup: defaultPopup,
    popup_on: 'click',
    readonly_progress: false,
    readonly_dates: false,
    readonly: false,
    scroll_to: 'today',
    show_expected_progress: false,
    today_button: true,
    view_mode: 'Day',
    view_mode_select: false,
    view_modes: DEFAULT_VIEW_MODES,
    is_weekend: (d) => d.getDay() === 0 || d.getDay() === 6,
};

export { DEFAULT_OPTIONS, DEFAULT_VIEW_MODES };
