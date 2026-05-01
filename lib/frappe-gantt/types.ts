/** Public task shape consumed by Gantt */
export interface GanttTask {
    id: string;
    name: string;
    start: Date | string;
    end?: Date | string;
    duration?: string;
    progress?: number;
    dependencies?: string | string[];
    custom_class?: string;
    color?: string;
    color_progress?: string;
    thumbnail?: string;
    invalid?: boolean;
    [key: string]: unknown;
}

/** Internal task after setup_tasks normalization */
export interface GanttTaskInternal extends GanttTask {
    _start: Date;
    _end: Date;
    _index: number;
    dependencies: string[];
}

export type ViewModeName = string;

export interface ViewMode {
    name: ViewModeName;
    padding?: string | [string, string];
    step: string;
    date_format?: string;
    column_width?: number;
    lower_text?: string | ((d: Date, ld: Date | null, lang: string) => string);
    upper_text?: string | ((d: Date, ld: Date | null, lang: string) => string);
    upper_text_frequency?: number;
    thick_line?: (d: Date) => boolean;
    snap_at?: string;
}

export interface GanttOptions {
    view_modes?: (ViewMode | string)[];
    view_mode?: ViewMode | string;
    view_mode_select?: boolean;
    today_button?: boolean;
    date_format?: string;
    infinite_padding?: boolean;
    move_dependencies?: boolean;
    restrict_drag_by_dependencies?: boolean;
    readonly_progress?: boolean;
    readonly?: boolean;
    readonly_dates?: boolean;
    auto_move_label?: boolean;
    column_width?: number | null;
    bar_height?: number | 'auto';
    lower_header_height?: number;
    upper_header_height?: number;
    container_height?: number | 'auto';
    padding?: number;
    bar_corner_radius?: number;
    lines?: 'none' | 'vertical' | 'horizontal' | string;
    scroll_to?: Date | string | null;
    popup?: boolean | PopupFactory;
    popup_on?: 'click' | 'hover';
    show_expected_progress?: boolean;
    language?: string;
    holidays?: Record<string, unknown>;
    is_weekend?: (d: Date) => boolean;
    ignore?: string | string[] | ((d: Date) => boolean);
    arrow_curve?: number;
    snap_at?: string | null;
    on_date_change?: (task: GanttTaskInternal, start: Date, end: Date) => void;
    on_progress_change?: (task: GanttTaskInternal, progress: number) => void;
    on_click?: (task: GanttTaskInternal) => void;
    on_double_click?: (task: GanttTaskInternal) => void;
    on_hover?: (
        task: GanttTaskInternal,
        screenX: number,
        screenY: number,
        e: MouseEvent,
    ) => void;
    on_view_change?: (mode: ViewMode) => void;
    [key: string]: unknown;
}

export type PopupFactory = (ctx: {
    task: GanttTaskInternal;
    chart: unknown;
    get_title: () => HTMLElement | null;
    set_title: (title: string) => void;
    get_subtitle: () => HTMLElement | null;
    set_subtitle: (subtitle: string) => void;
    get_details: () => HTMLElement | null;
    set_details: (details: string) => void;
    add_action: (
        html: string | ((task: GanttTaskInternal) => string),
        func: (task: GanttTaskInternal, gantt: unknown, e: MouseEvent) => void,
    ) => void;
}) => string | false | void;

export interface CreateElParams {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    id?: string;
    classes: string;
    append_to?: HTMLElement;
    type?: string;
}

/** Time unit strings used by date_utils.add / start_of */
export type DateScale =
    | 'year'
    | 'month'
    | 'day'
    | 'hour'
    | 'minute'
    | 'second'
    | 'millisecond';

export interface ParsedDuration {
    duration: number;
    scale: DateScale;
}

export interface ViewModeResolved extends ViewMode {
    padding: string | [string, string];
    upper_text: (d: Date, ld: Date | null, lang: string) => string;
    lower_text: (d: Date, ld: Date | null, lang: string) => string;
}

export interface GanttRuntimeConfig {
    ignored_dates: Date[];
    ignored_positions: number[];
    extend_by_units: number;
    ignored_function?: (d: Date) => boolean;
    step: number;
    unit: DateScale;
    column_width: number;
    header_height: number;
    view_mode: ViewMode;
    date_format: string;
}

export interface PopupShowParams {
    x: number;
    y: number;
    task: GanttTaskInternal;
    target: SVGElement;
}

/** Minimal chart handle passed into default popup (avoids circular import) */
export interface GanttChartLike {
    options: GanttOptions & Record<string, unknown>;
}

/** One column/header cell in the date strip */
export interface GanttDateCell {
    date: Date;
    formatted_date: string;
    column_width: number;
    x: number;
    upper_text: string;
    lower_text: string;
    upper_y: number;
    lower_y: number;
}
