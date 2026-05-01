import './svg_augment';
import date_utils from './date_utils';
import { $, createSVG } from './svg_utils';

import Arrow from './arrow';
import Bar from './bar';
import Popup from './popup';

import { DEFAULT_OPTIONS, DEFAULT_VIEW_MODES } from './defaults';

import type {
    CreateElParams,
    GanttDateCell,
    GanttOptions,
    GanttRuntimeConfig,
    GanttTask,
    GanttTaskInternal,
    PopupShowParams,
    ViewMode,
} from './types';

import './styles/gantt.css';

type MergedOptions = typeof DEFAULT_OPTIONS & GanttOptions;

export default class Gantt {
    static VIEW_MODE: Record<string, ViewMode>;

    $svg!: SVGSVGElement;
    $container!: HTMLElement;
    $popup_wrapper!: HTMLElement;
    original_options?: GanttOptions;
    options!: MergedOptions;
    config!: GanttRuntimeConfig;
    tasks!: GanttTaskInternal[];
    bars!: Bar[];
    arrows!: Arrow[];
    dependency_map!: Record<string, string[]>;
    dates!: Date[];
    gantt_start!: Date;
    gantt_end!: Date;
    layers!: {
        grid: SVGGElement;
        arrow: SVGGElement;
        progress: SVGGElement;
        bar: SVGGElement;
    };
    $extras!: HTMLElement;
    $adjust!: HTMLElement;
    $header!: HTMLElement;
    $lower_header!: HTMLElement;
    $upper_header!: HTMLElement;
    $side_header!: HTMLElement;
    grid_height!: number;
    popup?: Popup;
    upperTexts!: HTMLElement[];
    $current?: HTMLElement;
    $today_button?: HTMLButtonElement;
    $current_highlight?: HTMLElement;
    $current_ball_highlight?: HTMLElement;
    current_date!: Date;
    bar_being_dragged!: boolean | null;

    constructor(
        wrapper: string | HTMLElement | SVGElement,
        tasks: GanttTask[],
        options?: GanttOptions,
    ) {
        this.setup_wrapper(wrapper);
        this.setup_options(options ?? {});
        this.setup_tasks(tasks);
        this.change_view_mode();
        this.bind_events();
    }

    setup_wrapper(element: string | HTMLElement | SVGElement): void {
        let svg_element: SVGSVGElement | null;
        let wrapper_element: HTMLElement | undefined;

        // CSS Selector is passed
        if (typeof element === 'string') {
            const el = document.querySelector(element);
            if (!el) {
                throw new ReferenceError(
                    `CSS selector "${element}" could not be found in DOM`,
                );
            }
            element = el as HTMLElement | SVGElement;
        }

        // get the SVGElement
        if (element instanceof HTMLElement) {
            wrapper_element = element;
            svg_element = element.querySelector('svg') as SVGSVGElement | null;
        } else if (element instanceof SVGElement) {
            svg_element = element as SVGSVGElement;
        } else {
            throw new TypeError(
                'Frappe Gantt only supports usage of a string CSS selector,' +
                    " HTML DOM element or SVG DOM element for the 'element' parameter",
            );
        }

        // svg element
        if (!svg_element) {
            // create it
            this.$svg = createSVG('svg', {
                append_to: wrapper_element!,
                class: 'gantt',
            }) as SVGSVGElement;
        } else {
            this.$svg = svg_element;
            this.$svg.classList.add('gantt');
        }

        // wrapper element
        this.$container = this.create_el({
            classes: 'gantt-container',
            append_to: this.$svg.parentElement ?? undefined,
        });

        this.$container.appendChild(this.$svg);
        this.$popup_wrapper = this.create_el({
            classes: 'popup-wrapper',
            append_to: this.$container,
        });
    }

    setup_options(options: GanttOptions): void {
        this.original_options = options;
        if (options?.view_modes) {
            options.view_modes = options.view_modes
                .map((mode) => {
                    if (typeof mode === 'string') {
                        const predefined_mode = DEFAULT_VIEW_MODES.find(
                            (d) => d.name === mode,
                        );
                        if (!predefined_mode)
                            console.error(
                                `The view mode "${mode}" is not predefined in Frappe Gantt. Please define the view mode object instead.`,
                            );

                        return predefined_mode;
                    }
                    return mode;
                })
                .filter((m): m is ViewMode => m !== undefined);
            // automatically set the view mode to the first option
            const first = options.view_modes[0];
            if (first) options.view_mode = first;
        }
        this.options = { ...DEFAULT_OPTIONS, ...options } as MergedOptions;
        const CSS_VARIABLES = {
            'grid-height': 'container_height',
            'bar-height': 'bar_height',
            'lower-header-height': 'lower_header_height',
            'upper-header-height': 'upper_header_height',
        } as const;
        for (const name of Object.keys(CSS_VARIABLES) as Array<
            keyof typeof CSS_VARIABLES
        >) {
            const optKey = CSS_VARIABLES[name] as keyof MergedOptions;
            const setting = this.options[optKey];
            if (setting !== 'auto' && setting !== undefined)
                this.$container.style.setProperty(
                    '--gv-' + name,
                    String(setting) + 'px',
                );
        }

        this.config = {
            ignored_dates: [],
            ignored_positions: [],
            extend_by_units: 10,
        } as unknown as GanttRuntimeConfig;

        if (typeof this.options.ignore !== 'function') {
            if (typeof this.options.ignore === 'string')
                this.options.ignore = [this.options.ignore];
            for (let option of this.options.ignore ?? []) {
                if (typeof option === 'function') {
                    this.config.ignored_function = option;
                    continue;
                }
                if (typeof option === 'string') {
                    if (option === 'weekend')
                        this.config.ignored_function = (d) =>
                            d.getDay() == 6 || d.getDay() == 0;
                    else this.config.ignored_dates.push(new Date(option + ' '));
                }
            }
        } else {
            this.config.ignored_function = this.options.ignore;
        }
    }

    update_options(options: GanttOptions): void {
        this.setup_options({ ...(this.original_options ?? {}), ...options });
        this.change_view_mode(undefined, true);
    }

    setup_tasks(tasks: GanttTask[]): void {
        this.tasks = tasks
            .map((task, i): GanttTaskInternal | false => {
                if (!task.start) {
                    console.error(
                        `task "${task.id}" doesn't have a start date`,
                    );
                    return false;
                }

                const ti = task as GanttTaskInternal;
                ti._start = date_utils.parse(task.start);
                if (task.end === undefined && task.duration !== undefined) {
                    let endAcc: Date = ti._start;
                    const durations = task.duration.split(' ');

                    durations.forEach((tmpDuration) => {
                        const pd = date_utils.parse_duration(tmpDuration);
                        if (!pd) return;
                        const { duration, scale } = pd;
                        endAcc = date_utils.add(endAcc, duration, scale);
                    });
                    task.end = endAcc;
                }
                if (!task.end) {
                    console.error(`task "${task.id}" doesn't have an end date`);
                    return false;
                }
                ti._end = date_utils.parse(task.end as string | Date);

                let diff = date_utils.diff(ti._end, ti._start, 'year');
                if (diff < 0) {
                    console.error(
                        `start of task can't be after end of task: in task "${task.id}"`,
                    );
                    return false;
                }

                // make task invalid if duration too large
                if (date_utils.diff(ti._end, ti._start, 'year') > 10) {
                    console.error(
                        `the duration of task "${task.id}" is too long (above ten years)`,
                    );
                    return false;
                }

                // cache index
                ti._index = i;

                // if hours is not set, assume the last day is full day
                // e.g: 2018-09-09 becomes 2018-09-09 23:59:59
                const task_end_values = date_utils.get_date_values(ti._end);
                if (task_end_values.slice(3).every((d: number) => d === 0)) {
                    ti._end = date_utils.add(ti._end, 24, 'hour');
                }

                // dependencies
                if (
                    typeof task.dependencies === 'string' ||
                    !task.dependencies
                ) {
                    let deps: string[] = [];
                    if (task.dependencies) {
                        deps = task.dependencies
                            .split(',')
                            .map((d) => d.trim().replaceAll(' ', '_'))
                            .filter((d) => d);
                    }
                    task.dependencies = deps;
                }

                // uids
                if (!task.id) {
                    task.id = generate_id(task);
                } else if (typeof task.id === 'string') {
                    task.id = task.id.replaceAll(' ', '_');
                } else {
                    task.id = `${task.id}`;
                }

                return ti;
            })
            .filter((t): t is GanttTaskInternal => !!t);
        this.setup_dependencies();
    }

    add_tasks(tasks: GanttTask[]): void {
        const __tasks = tasks
            .map((task, i): GanttTaskInternal | false => {
                if (!task.start) {
                    console.error(
                        `task "${task.id}" doesn't have a start date`,
                    );
                    return false;
                }

                const ti = task as GanttTaskInternal;
                ti._start = date_utils.parse(task.start);
                if (task.end === undefined && task.duration !== undefined) {
                    let endAcc: Date = ti._start;
                    const durations = task.duration.split(' ');

                    durations.forEach((tmpDuration) => {
                        const pd = date_utils.parse_duration(tmpDuration);
                        if (!pd) return;
                        const { duration, scale } = pd;
                        endAcc = date_utils.add(endAcc, duration, scale);
                    });
                    task.end = endAcc;
                }
                if (!task.end) {
                    console.error(`task "${task.id}" doesn't have an end date`);
                    return false;
                }
                ti._end = date_utils.parse(task.end as string | Date);

                let diff = date_utils.diff(ti._end, ti._start, 'year');
                if (diff < 0) {
                    console.error(
                        `start of task can't be after end of task: in task "${task.id}"`,
                    );
                    return false;
                }

                // make task invalid if duration too large
                if (date_utils.diff(ti._end, ti._start, 'year') > 10) {
                    console.error(
                        `the duration of task "${task.id}" is too long (above ten years)`,
                    );
                    return false;
                }

                // cache index
                ti._index = this.tasks.length + i;

                // if hours is not set, assume the last day is full day
                // e.g: 2018-09-09 becomes 2018-09-09 23:59:59
                const task_end_values = date_utils.get_date_values(ti._end);
                if (task_end_values.slice(3).every((d: number) => d === 0)) {
                    ti._end = date_utils.add(ti._end, 24, 'hour');
                }

                // dependencies
                if (
                    typeof task.dependencies === 'string' ||
                    !task.dependencies
                ) {
                    let deps: string[] = [];
                    if (task.dependencies) {
                        deps = task.dependencies
                            .split(',')
                            .map((d) => d.trim().replaceAll(' ', '_'))
                            .filter((d) => d);
                    }
                    task.dependencies = deps;
                }

                // uids
                if (!task.id) {
                    task.id = generate_id(task);
                } else if (typeof task.id === 'string') {
                    task.id = task.id.replaceAll(' ', '_');
                } else {
                    task.id = `${task.id}`;
                }

                const bar = new Bar(this, ti);
                this.bars.push(bar);
                this.layers.bar.appendChild(bar.group);
                bar.refresh();

                return ti;
            })
            .filter((t): t is GanttTaskInternal => !!t);

        this.tasks.push(...__tasks);
        this.setup_dependencies();
    }

    setup_dependencies(): void {
        this.dependency_map = {};
        for (let t of this.tasks) {
            for (let d of t.dependencies) {
                this.dependency_map[d] = this.dependency_map[d] || [];
                this.dependency_map[d].push(t.id);
            }
        }
    }

    refresh(tasks: GanttTask[]): void {
        this.setup_tasks(tasks);
        this.change_view_mode();
    }

    update_task(id: string, new_details: GanttTaskInternal): void {
        new_details.id = new_details.id.replaceAll(' ', '_');
        // dependencies (normalize string form from callers)
        const rawDeps = new_details.dependencies as string | string[] | undefined;
        if (typeof rawDeps === 'string' || !rawDeps?.length) {
            new_details.dependencies =
                typeof rawDeps === 'string'
                    ? rawDeps
                          .split(',')
                          .map((d) => d.trim().replaceAll(' ', '_'))
                          .filter(Boolean)
                    : [];
        }

        const task = this.tasks.find((t) => t.id === id);
        if (!task) return;
        const bar = this.bars[task._index];
        if (!bar) return;
        Object.assign(task, new_details);
        bar.refresh();
    }

    change_view_mode(
        mode: ViewMode | string = this.options.view_mode as ViewMode | string,
        maintain_pos = false,
    ): void {
        let resolved: ViewMode;
        if (typeof mode === 'string') {
            const found = (this.options.view_modes as ViewMode[]).find(
                (d) => d.name === mode,
            );
            if (!found) {
                console.error(`View mode "${mode}" not found`);
                return;
            }
            resolved = found;
        } else {
            resolved = mode;
        }
        let old_pos = 0;
        let old_scroll_op: MergedOptions['scroll_to'];
        if (maintain_pos) {
            old_pos = this.$container.scrollLeft;
            old_scroll_op = this.options.scroll_to;
            this.options.scroll_to = null;
        }
        this.options.view_mode = resolved.name;
        this.config.view_mode = resolved;
        this.update_view_scale(resolved);
        this.setup_dates(maintain_pos);
        this.render();
        if (maintain_pos) {
            this.$container.scrollLeft = old_pos;
            this.options.scroll_to = old_scroll_op;
        }
        this.trigger_event('view_change', [resolved]);
    }

    update_view_scale(mode: ViewMode): void {
        const parsed = date_utils.parse_duration(mode.step);
        if (!parsed) {
            throw new Error(`Invalid view mode step: ${mode.step}`);
        }
        let { duration, scale } = parsed;
        this.config.step = duration;
        this.config.unit = scale;
        this.config.column_width =
            this.options.column_width || mode.column_width || 45;
        this.$container.style.setProperty(
            '--gv-column-width',
            this.config.column_width + 'px',
        );
        this.config.header_height =
            (this.options.lower_header_height ?? 30) +
            (this.options.upper_header_height ?? 45) +
            10;
    }

    setup_dates(refresh = false): void {
        this.setup_gantt_dates(refresh);
        this.setup_date_values();
    }

    setup_gantt_dates(refresh?: boolean): void {
        let gantt_start: Date | undefined;
        let gantt_end: Date | undefined;
        if (!this.tasks.length) {
            gantt_start = new Date();
            gantt_end = new Date();
        }

        for (const task of this.tasks) {
            if (!gantt_start || task._start < gantt_start) {
                gantt_start = task._start;
            }
            if (!gantt_end || task._end > gantt_end) {
                gantt_end = task._end;
            }
        }

        if (!gantt_start || !gantt_end) {
            gantt_start = new Date();
            gantt_end = new Date();
        }

        gantt_start = date_utils.start_of(gantt_start, this.config.unit);
        gantt_end = date_utils.start_of(gantt_end, this.config.unit);

        if (!refresh) {
            if (!this.options.infinite_padding) {
                if (typeof this.config.view_mode.padding === 'string')
                    this.config.view_mode.padding = [
                        this.config.view_mode.padding,
                        this.config.view_mode.padding,
                    ];

                const padStrings = this.config.view_mode.padding as [
                    string,
                    string,
                ];
                const padding_start = date_utils.parse_duration(padStrings[0]);
                const padding_end = date_utils.parse_duration(padStrings[1]);
                if (!padding_start || !padding_end) {
                    throw new Error('Invalid view_mode.padding duration');
                }
                this.gantt_start = date_utils.add(
                    gantt_start,
                    -padding_start.duration,
                    padding_start.scale,
                );
                this.gantt_end = date_utils.add(
                    gantt_end,
                    padding_end.duration,
                    padding_end.scale,
                );
            } else {
                this.gantt_start = date_utils.add(
                    gantt_start,
                    -this.config.extend_by_units * 3,
                    this.config.unit,
                );
                this.gantt_end = date_utils.add(
                    gantt_end,
                    this.config.extend_by_units * 3,
                    this.config.unit,
                );
            }
        }
        this.config.date_format =
            this.config.view_mode.date_format ||
            this.options.date_format ||
            'YYYY-MM-DD';
        this.gantt_start.setHours(0, 0, 0, 0);
    }

    setup_date_values(): void {
        let cur_date = this.gantt_start;
        this.dates = [cur_date];

        while (cur_date < this.gantt_end) {
            cur_date = date_utils.add(
                cur_date,
                this.config.step,
                this.config.unit,
            );
            this.dates.push(cur_date);
        }
    }

    bind_events(): void {
        this.bind_grid_click();
        this.bind_holiday_labels();
        this.bind_bar_events();
    }

    render(): void {
        this.clear();
        this.setup_layers();
        this.make_grid();
        this.make_dates();
        this.make_grid_extras();
        this.make_bars();
        this.make_arrows();
        this.map_arrows_on_bars();
        this.set_dimensions();
        this.set_scroll_position(this.options.scroll_to);
    }

    setup_layers(): void {
        const layers = ['grid', 'arrow', 'progress', 'bar'] as const;
        const built = {} as Gantt['layers'];
        for (const layer of layers) {
            built[layer] = createSVG('g', {
                class: layer,
                append_to: this.$svg,
            }) as SVGGElement;
        }
        this.layers = built;
        this.$extras = this.create_el({
            classes: 'extras',
            append_to: this.$container,
        });
        this.$adjust = this.create_el({
            classes: 'adjust hide',
            append_to: this.$extras,
            type: 'button',
        });
        this.$adjust.innerHTML = '&larr;';
    }

    make_grid(): void {
        this.make_grid_background();
        this.make_grid_rows();
        this.make_grid_header();
        this.make_side_header();
    }

    make_grid_extras(): void {
        this.make_grid_highlights();
        this.make_grid_ticks();
    }

    make_grid_background(): void {
        const pad = this.options.padding ?? 18;
        const barH =
            typeof this.options.bar_height === 'number'
                ? this.options.bar_height
                : 30;
        const grid_width = this.dates.length * this.config.column_width;
        const grid_height = Math.max(
            this.config.header_height +
                pad +
                (barH + pad) * this.tasks.length -
                10,
            this.options.container_height !== 'auto'
                ? (this.options.container_height as number)
                : 0,
        );

        createSVG('rect', {
            x: 0,
            y: 0,
            width: grid_width,
            height: grid_height,
            class: 'grid-background',
            append_to: this.$svg,
        });

        $.attr(this.$svg, {
            height: grid_height,
            width: '100%',
        });
        this.grid_height = grid_height;
        if (this.options.container_height === 'auto')
            this.$container.style.height = grid_height + 'px';
    }

    make_grid_rows(): void {
        const rows_layer = createSVG('g', { append_to: this.layers.grid });

        const row_width = this.dates.length * this.config.column_width;
        const pad = this.options.padding ?? 18;
        const barH =
            typeof this.options.bar_height === 'number'
                ? this.options.bar_height
                : 30;
        const row_height = barH + pad;

        for (
            let rowY = this.config.header_height;
            rowY < this.grid_height;
            rowY += row_height
        ) {
            createSVG('rect', {
                x: 0,
                y: rowY,
                width: row_width,
                height: row_height,
                class: 'grid-row',
                append_to: rows_layer,
            });
        }
    }

    make_grid_header(): void {
        this.$header = this.create_el({
            width: this.dates.length * this.config.column_width,
            classes: 'grid-header',
            append_to: this.$container,
        });

        this.$upper_header = this.create_el({
            classes: 'upper-header',
            append_to: this.$header,
        });
        this.$lower_header = this.create_el({
            classes: 'lower-header',
            append_to: this.$header,
        });
    }

    make_side_header(): void {
        this.$side_header = this.create_el({ classes: 'side-header' });
        this.$upper_header.prepend(this.$side_header);

        // Create view mode change select
        if (this.options.view_mode_select) {
            const $select = document.createElement('select');
            $select.classList.add('viewmode-select');

            const $el = document.createElement('option');
            $el.selected = true;
            $el.disabled = true;
            $el.textContent = 'Mode';
            $select.appendChild($el);

            for (const mode of this.options.view_modes) {
                const $option = document.createElement('option');
                $option.value = mode.name;
                $option.textContent = mode.name;
                if (mode.name === this.config.view_mode.name)
                    $option.selected = true;
                $select.appendChild($option);
            }

            $select.addEventListener(
                'change',
                function () {
                    this.change_view_mode($select.value, true);
                }.bind(this),
            );
            this.$side_header.appendChild($select);
        }

        // Create today button
        if (this.options.today_button) {
            let $today_button = document.createElement('button');
            $today_button.classList.add('today-button');
            $today_button.textContent = 'Today';
            $today_button.onclick = this.scroll_current.bind(this);
            this.$side_header.prepend($today_button);
            this.$today_button = $today_button;
        }
    }

    make_grid_ticks(): void {
        if (this.options.lines === 'none') return;
        let tick_x = 0;
        let tick_y = this.config.header_height;
        let tick_height = this.grid_height - this.config.header_height;

        let $lines_layer = createSVG('g', {
            class: 'lines_layer',
            append_to: this.layers.grid,
        });

        let row_y = this.config.header_height;

        const row_width = this.dates.length * this.config.column_width;
        const pad = this.options.padding ?? 18;
        const barH =
            typeof this.options.bar_height === 'number'
                ? this.options.bar_height
                : 30;
        const row_height = barH + pad;
        if (this.options.lines !== 'vertical') {
            for (
                let y = this.config.header_height;
                y < this.grid_height;
                y += row_height
            ) {
                createSVG('line', {
                    x1: 0,
                    y1: row_y + row_height,
                    x2: row_width,
                    y2: row_y + row_height,
                    class: 'row-line',
                    append_to: $lines_layer,
                });
                row_y += row_height;
            }
        }
        if (this.options.lines === 'horizontal') return;

        for (let date of this.dates) {
            let tick_class = 'tick';
            if (
                this.config.view_mode.thick_line &&
                this.config.view_mode.thick_line(date)
            ) {
                tick_class += ' thick';
            }

            createSVG('path', {
                d: `M ${tick_x} ${tick_y} v ${tick_height}`,
                class: tick_class,
                append_to: this.layers.grid,
            });

            if (this.view_is('month')) {
                tick_x +=
                    (date_utils.get_days_in_month(date) *
                        this.config.column_width) /
                    30;
            } else if (this.view_is('year')) {
                tick_x +=
                    (date_utils.get_days_in_year(date) *
                        this.config.column_width) /
                    365;
            } else {
                tick_x += this.config.column_width;
            }
        }
    }

    highlight_holidays(): void {
        const labels: Record<number, string> = {};
        if (!this.options.holidays) return;

        const holidayMap = this.options.holidays as Record<string, unknown>;

        for (const color of Object.keys(holidayMap)) {
            let check_highlight: unknown = holidayMap[color];
            if (check_highlight === 'weekend') {
                check_highlight = this.options.is_weekend;
            }
            let extra_func: ((d: Date) => boolean) | undefined;

            if (typeof check_highlight === 'object' && check_highlight !== null) {
                if (Array.isArray(check_highlight)) {
                    const fn = check_highlight.find(
                        (k: unknown) => typeof k === 'function',
                    ) as ((d: Date) => boolean) | undefined;
                    if (fn) extra_func = fn;
                }
                const obj = check_highlight as Record<string, unknown>;
                if (obj.name != null && obj.date != null) {
                    const dateObj = new Date(String(obj.date) + ' ');
                    labels[dateObj.getTime()] = String(obj.name);
                    check_highlight = (d: Date) =>
                        dateObj.getTime() === d.getTime();
                } else if (Array.isArray(check_highlight)) {
                    const arr = check_highlight as unknown[];
                    check_highlight = (d: Date) =>
                        arr
                            .filter((k) => typeof k !== 'function')
                            .map((k: unknown) => {
                                if (
                                    typeof k === 'object' &&
                                    k !== null &&
                                    'name' in (k as object) &&
                                    'date' in (k as object)
                                ) {
                                    const ko = k as { name: string; date: string };
                                    const dateObj = new Date(ko.date + ' ');
                                    labels[dateObj.getTime()] = ko.name;
                                    return dateObj.getTime();
                                }
                                return new Date(String(k) + ' ').getTime();
                            })
                            .includes(d.getTime());
                }
            }

            if (typeof check_highlight !== 'function') continue;
            const highlightFn = check_highlight as (d: Date) => boolean;

            for (
                let d = new Date(this.gantt_start);
                d <= this.gantt_end;
                d.setDate(d.getDate() + 1)
            ) {
                if (
                    this.config.ignored_dates.find(
                        (k) => k.getTime() == d.getTime(),
                    ) ||
                    (this.config.ignored_function &&
                        this.config.ignored_function(d))
                )
                    continue;
                if (highlightFn(d) || (extra_func && extra_func(d))) {
                    const x =
                        (date_utils.diff(
                            d,
                            this.gantt_start,
                            this.config.unit,
                        ) /
                            this.config.step) *
                        this.config.column_width;
                    const height = this.grid_height - this.config.header_height;
                    const d_formatted = date_utils
                        .format(d, 'YYYY-MM-DD', this.options.language)
                        .replace(' ', '_');

                    const labelText = labels[d.getTime()];
                    if (labelText) {
                        const label = this.create_el({
                            classes: 'holiday-label ' + 'label_' + d_formatted,
                            append_to: this.$extras,
                        });
                        label.textContent = labelText;
                    }
                    createSVG('rect', {
                        x: Math.round(x),
                        y: this.config.header_height,
                        width:
                            this.config.column_width /
                            date_utils.convert_scales(
                                this.config.view_mode.step,
                                'day',
                            ),
                        height,
                        class: 'holiday-highlight ' + d_formatted,
                        style: `fill: ${color};`,
                        append_to: this.layers.grid,
                    });
                }
            }
        }
    }

    /**
     * Compute the horizontal x-axis distance and associated date for the current date and view.
     *
     * @returns Object containing the x-axis distance and date of the current date, or null if the current date is out of the gantt range.
     */
    highlight_current(): void {
        const res = this.get_closest_date();
        if (!res) return;

        const [, el] = res;
        el?.classList.add('current-date-highlight');

        const diff_in_units = date_utils.diff(
            new Date(),
            this.gantt_start,
            this.config.unit,
        );

        const left =
            (diff_in_units / this.config.step) * this.config.column_width;

        this.$current_highlight = this.create_el({
            top: this.config.header_height,
            left,
            height: this.grid_height - this.config.header_height,
            classes: 'current-highlight',
            append_to: this.$container,
        });
        this.$current_ball_highlight = this.create_el({
            top: this.config.header_height - 6,
            left: left - 2.5,
            width: 6,
            height: 6,
            classes: 'current-ball-highlight',
            append_to: this.$header,
        });
    }

    make_grid_highlights(): void {
        this.highlight_holidays();
        this.config.ignored_positions = [];

        const pad = this.options.padding ?? 18;
        const barH =
            typeof this.options.bar_height === 'number'
                ? this.options.bar_height
                : 30;
        const height = (barH + pad) * this.tasks.length;
        this.layers.grid.innerHTML += `<pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4" height="4">
          <path d="M-1,1 l2,-2
                   M0,4 l4,-4
                   M3,5 l2,-2"
                style="stroke:grey; stroke-width:0.3" />
        </pattern>`;

        for (
            let d = new Date(this.gantt_start);
            d <= this.gantt_end;
            d.setDate(d.getDate() + 1)
        ) {
            if (
                !this.config.ignored_dates.find(
                    (k) => k.getTime() == d.getTime(),
                ) &&
                (!this.config.ignored_function ||
                    !this.config.ignored_function(d))
            )
                continue;
            let diff =
                date_utils.convert_scales(
                    date_utils.diff(d, this.gantt_start) + 'd',
                    this.config.unit,
                ) / this.config.step;

            this.config.ignored_positions.push(diff * this.config.column_width);
            createSVG('rect', {
                x: diff * this.config.column_width,
                y: this.config.header_height,
                width: this.config.column_width,
                height: height,
                class: 'ignored-bar',
                style: 'fill: url(#diagonalHatch);',
                append_to: this.$svg,
            });
        }

        this.highlight_current();
    }

    create_el({
        left,
        top,
        width,
        height,
        id,
        classes,
        append_to,
        type,
    }: CreateElParams): HTMLElement {
        const $el = document.createElement(type || 'div');
        for (const cls of classes.split(' ').filter(Boolean)) {
            $el.classList.add(cls);
        }
        if (top !== undefined) $el.style.top = top + 'px';
        if (left !== undefined) $el.style.left = left + 'px';
        if (id) $el.id = id;
        if (width !== undefined) $el.style.width = width + 'px';
        if (height !== undefined) $el.style.height = height + 'px';
        if (append_to) append_to.appendChild($el);
        return $el;
    }

    make_dates(): void {
        this.get_dates_to_draw().forEach((date, i) => {
            if (date.lower_text) {
                let $lower_text = this.create_el({
                    left: date.x,
                    top: date.lower_y,
                    classes: 'lower-text date_' + sanitize(date.formatted_date),
                    append_to: this.$lower_header,
                });
                $lower_text.innerText = date.lower_text;
            }

            if (date.upper_text) {
                let $upper_text = this.create_el({
                    left: date.x,
                    top: date.upper_y,
                    classes: 'upper-text',
                    append_to: this.$upper_header,
                });
                $upper_text.innerText = date.upper_text;
            }
        });
        this.upperTexts = Array.from(
            this.$container.querySelectorAll('.upper-text'),
        );
    }

    get_dates_to_draw(): GanttDateCell[] {
        let last_date_info: GanttDateCell | null = null;
        const dates = this.dates.map((date, i) => {
            const d = this.get_date_info(date, last_date_info, i);
            last_date_info = d;
            return d;
        });
        return dates;
    }

    get_date_info(
        date: Date,
        last_date_info: GanttDateCell | null,
        _i?: number,
    ): GanttDateCell {
        const last_date = last_date_info ? last_date_info.date : null;

        const x = last_date_info
            ? last_date_info.x + last_date_info.column_width
            : 0;

        const vm = this.config.view_mode;
        let upper_text = vm.upper_text;
        let lower_text = vm.lower_text;

        if (!upper_text) {
            vm.upper_text = () => '';
        } else if (typeof upper_text === 'string') {
            const fmt = upper_text;
            vm.upper_text = (d, ld, lang) =>
                date_utils.format(d, fmt, lang ?? this.options.language);
        }

        if (!lower_text) {
            vm.lower_text = () => '';
        } else if (typeof lower_text === 'string') {
            const fmt = lower_text;
            vm.lower_text = (d, ld, lang) =>
                date_utils.format(d, fmt, lang ?? this.options.language);
        }

        const upperFn = vm.upper_text as (
            d: Date,
            ld: Date | null,
            lang: string,
        ) => string;
        const lowerFn = vm.lower_text as (
            d: Date,
            ld: Date | null,
            lang: string,
        ) => string;
        const lang = this.options.language ?? 'en';

        return {
            date,
            formatted_date: sanitize(
                date_utils.format(date, this.config.date_format, lang),
            ),
            column_width: this.config.column_width,
            x,
            upper_text: upperFn(date, last_date, lang),
            lower_text: lowerFn(date, last_date, lang),
            upper_y: 17,
            lower_y: (this.options.upper_header_height ?? 45) + 5,
        };
    }

    make_bars(): void {
        this.bars = this.tasks.map((task) => {
            const bar = new Bar(this, task);
            this.layers.bar.appendChild(bar.group);
            return bar;
        });
    }

    make_arrows(): void {
        this.arrows = [];
        for (let task of this.tasks) {
            let arrows = [];
            arrows = task.dependencies
                .map((task_id) => {
                    const dependency = this.get_task(task_id);
                    if (!dependency) return undefined;
                    const arrow = new Arrow(
                        this,
                        this.bars[dependency._index],
                        this.bars[task._index],
                    );
                    this.layers.arrow.appendChild(arrow.element);
                    return arrow;
                })
                .filter((a): a is Arrow => !!a);
            this.arrows = this.arrows.concat(arrows);
        }
    }

    map_arrows_on_bars(): void {
        for (let bar of this.bars) {
            bar.arrows = this.arrows.filter((arrow) => {
                return (
                    arrow.from_task.task.id === bar.task.id ||
                    arrow.to_task.task.id === bar.task.id
                );
            });
        }
    }

    set_dimensions(): void {
        const { width: cur_width } = this.$svg.getBoundingClientRect();
        const gridRow = this.$svg.querySelector('.grid .grid-row');
        const actual_width = gridRow
            ? Number(gridRow.getAttribute('width')) || 0
            : 0;
        if (cur_width < actual_width) {
            this.$svg.setAttribute('width', String(actual_width));
        }
    }

    set_scroll_position(date: Date | string | null | undefined): void {
        if (this.options.infinite_padding && (!date || date === 'start')) {
            let [min_start, ..._] = this.get_start_end_positions();
            this.$container.scrollLeft = min_start;
            return;
        }
        if (!date || date === 'start') {
            date = this.gantt_start;
        } else if (date === 'end') {
            date = this.gantt_end;
        } else if (date === 'today') {
            return this.scroll_current();
        } else if (typeof date === 'string') {
            date = date_utils.parse(date);
        }

        // Weird bug where infinite padding results in one day offset in scroll
        // Related to header-body displacement
        const units_since_first_task = date_utils.diff(
            date,
            this.gantt_start,
            this.config.unit,
        );
        const scroll_pos =
            (units_since_first_task / this.config.step) *
            this.config.column_width;

        this.$container.scrollTo({
            left: scroll_pos - this.config.column_width / 6,
            behavior: 'smooth',
        });

        // Calculate current scroll position's upper text
        if (this.$current) {
            this.$current.classList.remove('current-upper');
        }

        const upperTextFn = this.config.view_mode.upper_text as (
            d: Date,
            ld: Date | null,
            lang: string,
        ) => string;
        const lang = this.options.language ?? 'en';

        this.current_date = date_utils.add(
            this.gantt_start,
            this.$container.scrollLeft / this.config.column_width,
            this.config.unit,
        );

        let current_upper = upperTextFn(
            this.current_date,
            null,
            lang,
        );
        let $el = this.upperTexts.find(
            (el) => el.textContent === current_upper,
        );
        const elWidth = $el?.clientWidth ?? 0;

        // Recalculate
        this.current_date = date_utils.add(
            this.gantt_start,
            (this.$container.scrollLeft + elWidth) /
                this.config.column_width,
            this.config.unit,
        );
        current_upper = upperTextFn(this.current_date, null, lang);
        $el = this.upperTexts.find((el) => el.textContent === current_upper);
        if ($el) {
            $el.classList.add('current-upper');
            this.$current = $el;
        }
    }

    scroll_current(): void {
        let res = this.get_closest_date();
        if (res) this.set_scroll_position(res[0]);
    }

    get_closest_date(): [Date, Element | null] | null {
        let now = new Date();
        if (now < this.gantt_start || now > this.gantt_end) return null;

        let current = new Date(),
            el = this.$container.querySelector(
                '.date_' +
                    sanitize(
                        date_utils.format(
                            current,
                            this.config.date_format,
                            this.options.language,
                        ),
                    ),
            );

        // safety check to prevent infinite loop
        let c = 0;
        while (!el && c < this.config.step) {
            current = date_utils.add(current, -1, this.config.unit);
            el = this.$container.querySelector(
                '.date_' +
                    sanitize(
                        date_utils.format(
                            current,
                            this.config.date_format,
                            this.options.language,
                        ),
                    ),
            );
            c++;
        }
        return [
            new Date(
                date_utils.format(
                    current,
                    this.config.date_format,
                    this.options.language,
                ) + ' ',
            ),
            el,
        ];
    }

    bind_grid_click(): void {
        $.on(
            this.$container,
            'click',
            '.grid-row, .grid-header, .ignored-bar, .holiday-highlight',
            () => {
                this.unselect_all();
                this.hide_popup();
            },
        );
    }

    bind_holiday_labels(): void {
        const $highlights =
            this.$container.querySelectorAll('.holiday-highlight');
        for (const h of Array.from($highlights)) {
            const label = this.$container.querySelector(
                '.label_' + h.classList[1],
            ) as HTMLElement | null;
            if (!label) continue;
            let timeout: ReturnType<typeof setTimeout> | undefined;
            (h as HTMLElement).onmouseenter = (e: MouseEvent) => {
                timeout = setTimeout(() => {
                    label.classList.add('show');
                    label.style.left = (e.offsetX || e.layerX || 0) + 'px';
                    label.style.top = (e.offsetY || e.layerY || 0) + 'px';
                }, 300);
            };

            (h as HTMLElement).onmouseleave = () => {
                clearTimeout(timeout);
                label.classList.remove('show');
            };
        }
    }

    get_start_end_positions(): [number, number, number] {
        if (!this.bars.length) return [0, 0, 0];
        let { x, width } = (
            this.bars[0].group as SVGGraphicsElement
        ).getBBox();
        let min_start = x;
        let max_start = x;
        let max_end = x + width;
        this.bars.forEach((bar) => {
            const { group } = bar;
            const box = (group as SVGGraphicsElement).getBBox();
            if (box.x < min_start) min_start = box.x;
            if (box.x > max_start) max_start = box.x;
            if (box.x + box.width > max_end) max_end = box.x + box.width;
        });
        return [min_start, max_start, max_end];
    }

    bind_bar_events(): void {
        let is_dragging = false;
        let x_on_start = 0;
        let x_on_scroll_start = 0;
        let is_resizing_left = false;
        let is_resizing_right = false;
        let parent_bar_id: string | null = null;
        let bars: Bar[] = [];
        this.bar_being_dragged = null;

        const action_in_progress = () =>
            is_dragging || is_resizing_left || is_resizing_right;

        this.$svg.onclick = (e: MouseEvent) => {
            const t = e.target;
            if (t instanceof Element && t.classList.contains('grid-row'))
                this.unselect_all();
        };

        let pos = 0;
        $.on(this.$svg, 'mousemove', '.bar-wrapper, .handle', (e) => {
            if (
                this.bar_being_dragged === false &&
                Math.abs((e.offsetX || e.layerX || 0) - pos) > 10
            )
                this.bar_being_dragged = true;
        });

        $.on(this.$svg, 'mousedown', '.bar-wrapper, .handle', (e, element) => {
            const bar_wrapper = $.closest('.bar-wrapper', element);
            if (!bar_wrapper) return;
            if (element.classList.contains('left')) {
                is_resizing_left = true;
                element.classList.add('visible');
            } else if (element.classList.contains('right')) {
                is_resizing_right = true;
                element.classList.add('visible');
            } else if (element.classList.contains('bar-wrapper')) {
                is_dragging = true;
            }

            if (this.popup) this.popup.hide();

            x_on_start = e.offsetX || e.layerX || 0;

            parent_bar_id = bar_wrapper.getAttribute('data-id');
            if (!parent_bar_id) return;
            const ids: string[] = this.options.move_dependencies
                ? [parent_bar_id, ...this.get_all_dependent_tasks(parent_bar_id)]
                : [parent_bar_id];
            bars = ids.map((id) => this.get_bar(id)).filter((b): b is Bar => !!b);

            this.bar_being_dragged = false;
            pos = x_on_start;

            bars.forEach((bar) => {
                const $bar = bar.$bar;
                $bar.ox = $bar.getX();
                $bar.oy = $bar.getY();
                $bar.owidth = $bar.getWidth();
                $bar.finaldx = 0;
            });
        });

        if (this.options.infinite_padding) {
            let extended = false;
            $.on(this.$container, 'mousewheel', (e: Event) => {
                const wheelEl = e.currentTarget as HTMLElement;
                let trigger = this.$container.scrollWidth / 2;
                if (!extended && wheelEl.scrollLeft <= trigger) {
                    let old_scroll_left = wheelEl.scrollLeft;
                    extended = true;

                    this.gantt_start = date_utils.add(
                        this.gantt_start,
                        -this.config.extend_by_units,
                        this.config.unit,
                    );
                    this.setup_date_values();
                    this.render();
                    wheelEl.scrollLeft =
                        old_scroll_left +
                        this.config.column_width * this.config.extend_by_units;
                    setTimeout(() => (extended = false), 300);
                }

                if (
                    !extended &&
                    wheelEl.scrollWidth -
                        (wheelEl.scrollLeft + wheelEl.clientWidth) <=
                        trigger
                ) {
                    let old_scroll_left = wheelEl.scrollLeft;
                    extended = true;
                    this.gantt_end = date_utils.add(
                        this.gantt_end,
                        this.config.extend_by_units,
                        this.config.unit,
                    );
                    this.setup_date_values();
                    this.render();
                    wheelEl.scrollLeft = old_scroll_left;
                    setTimeout(() => (extended = false), 300);
                }
            });
        }

        const upperTextFnScroll = this.config.view_mode.upper_text as (
            d: Date,
            ld: Date | null,
            lang: string,
        ) => string;
        const langScroll = this.options.language ?? 'en';

        $.on(this.$container, 'scroll', (e: Event) => {
            const scrollEl = e.currentTarget as HTMLElement;
            let localBars: Bar[] = [];
            const ids = this.bars
                .map(({ group }) => group.getAttribute('data-id'))
                .filter((id): id is string => id != null);
            let dx: number | undefined;
            if (x_on_scroll_start) {
                dx = scrollEl.scrollLeft - x_on_scroll_start;
            }

            // Calculate current scroll position's upper text
            this.current_date = date_utils.add(
                this.gantt_start,
                (scrollEl.scrollLeft / this.config.column_width) *
                    this.config.step,
                this.config.unit,
            );

            let current_upper = upperTextFnScroll(
                this.current_date,
                null,
                langScroll,
            );
            let $el = this.upperTexts.find(
                (el) => el.textContent === current_upper,
            );
            const scrollElWidth = $el?.clientWidth ?? 0;

            // Recalculate for smoother experience
            this.current_date = date_utils.add(
                this.gantt_start,
                ((scrollEl.scrollLeft + scrollElWidth) /
                    this.config.column_width) *
                    this.config.step,
                this.config.unit,
            );
            current_upper = upperTextFnScroll(
                this.current_date,
                null,
                langScroll,
            );
            $el = this.upperTexts.find(
                (el) => el.textContent === current_upper,
            );

            if ($el && $el !== this.$current) {
                if (this.$current)
                    this.$current.classList.remove('current-upper');

                $el.classList.add('current-upper');
                this.$current = $el;
            }

            x_on_scroll_start = scrollEl.scrollLeft;
            let [min_start, max_start, max_end] =
                this.get_start_end_positions();

            if (x_on_scroll_start > max_end + 100) {
                this.$adjust.innerHTML = '&larr;';
                this.$adjust.classList.remove('hide');
                this.$adjust.onclick = () => {
                    this.$container.scrollTo({
                        left: max_start,
                        behavior: 'smooth',
                    });
                };
            } else if (
                x_on_scroll_start + scrollEl.offsetWidth <
                min_start - 100
            ) {
                this.$adjust.innerHTML = '&rarr;';
                this.$adjust.classList.remove('hide');
                this.$adjust.onclick = () => {
                    this.$container.scrollTo({
                        left: min_start,
                        behavior: 'smooth',
                    });
                };
            } else {
                this.$adjust.classList.add('hide');
            }

            if (dx !== undefined) {
                const scrollDx = dx;
                localBars = ids.map((id) => this.get_bar(id)).filter(
                    (b): b is Bar => !!b,
                );
                if (this.options.auto_move_label) {
                    localBars.forEach((bar) => {
                        bar.update_label_position_on_horizontal_scroll({
                            x: scrollDx,
                            sx: scrollEl.scrollLeft,
                        });
                    });
                }
            }
        });

        $.on(this.$svg, 'mousemove', (e: MouseEvent) => {
            if (!action_in_progress()) return;
            const dx = (e.offsetX || e.layerX || 0) - x_on_start;

            bars.forEach((bar) => {
                const $bar = bar.$bar;
                const ox = $bar.ox ?? 0;
                const owidth = $bar.owidth ?? 0;
                $bar.finaldx = this.get_snap_position(dx, ox);
                const fdx = $bar.finaldx ?? 0;
                this.hide_popup();
                if (is_resizing_left) {
                    if (parent_bar_id === bar.task.id) {
                        bar.update_bar_position({
                            x: ox + fdx,
                            width: owidth - fdx,
                        });
                    } else {
                        bar.update_bar_position({
                            x: ox + fdx,
                        });
                    }
                } else if (is_resizing_right) {
                    if (parent_bar_id === bar.task.id) {
                        bar.update_bar_position({
                            width: owidth + fdx,
                        });
                    }
                } else if (
                    is_dragging &&
                    !this.options.readonly &&
                    !this.options.readonly_dates
                ) {
                    bar.update_bar_position({ x: ox + fdx });
                }
            });
        });

        document.addEventListener('mouseup', () => {
            is_dragging = false;
            is_resizing_left = false;
            is_resizing_right = false;
            this.$container
                .querySelector('.visible')
                ?.classList?.remove?.('visible');
        });

        $.on(this.$svg, 'mouseup', (e) => {
            this.bar_being_dragged = null;
            bars.forEach((bar) => {
                const $bar = bar.$bar;
                if (!$bar.finaldx) return;
                bar.date_changed();
                bar.compute_progress();
                bar.set_action_completed();
            });
        });

        this.bind_bar_progress();
    }

    bind_bar_progress(): void {
        let x_on_start = 0;
        let is_resizing: boolean | null = null;
        let bar: Bar | null = null;
        let $bar_progress: SVGElement | null = null;
        let $bar: SVGElement | null = null;

        $.on(this.$svg, 'mousedown', '.handle.progress', (e, handle) => {
            is_resizing = true;
            x_on_start = e.offsetX || e.layerX || 0;

            const $bar_wrapper = $.closest('.bar-wrapper', handle);
            if (!$bar_wrapper) return;
            const id = $bar_wrapper.getAttribute('data-id');
            if (!id) return;
            const b = this.get_bar(id);
            if (!b) return;
            bar = b;

            $bar_progress = b.$bar_progress;
            $bar = b.$bar;

            $bar_progress.finaldx = 0;
            $bar_progress.owidth = $bar_progress.getWidth();
            $bar_progress.min_dx = -$bar_progress.owidth;
            $bar_progress.max_dx = $bar.getWidth() - $bar_progress.getWidth();
        });

        const range_positions = this.config.ignored_positions.map((d) => [
            d,
            d + this.config.column_width,
        ]);

        $.on(this.$svg, 'mousemove', (e: MouseEvent) => {
            if (!is_resizing || !$bar_progress || !$bar || !bar) return;
            let now_x = e.offsetX || e.layerX || 0;

            let moving_right = now_x > x_on_start;
            if (moving_right) {
                let k = range_positions.find(
                    ([begin, end]) => now_x >= begin && now_x < end,
                );
                while (k) {
                    now_x = k[1];
                    k = range_positions.find(
                        ([begin, end]) => now_x >= begin && now_x < end,
                    );
                }
            } else {
                let k = range_positions.find(
                    ([begin, end]) => now_x > begin && now_x <= end,
                );
                while (k) {
                    now_x = k[0];
                    k = range_positions.find(
                        ([begin, end]) => now_x > begin && now_x <= end,
                    );
                }
            }

            let dx = now_x - x_on_start;
            if ($bar_progress.max_dx != null && dx > $bar_progress.max_dx) {
                dx = $bar_progress.max_dx;
            }
            if ($bar_progress.min_dx != null && dx < $bar_progress.min_dx) {
                dx = $bar_progress.min_dx;
            }

            $bar_progress.setAttribute(
                'width',
                String($bar_progress.owidth! + dx),
            );
            if (bar.$handle_progress) {
                $.attr(bar.$handle_progress, 'cx', $bar_progress.getEndX());
            }

            $bar_progress.finaldx = dx;
        });

        $.on(this.$svg, 'mouseup', () => {
            is_resizing = false;
            if (!$bar_progress || !$bar_progress.finaldx || !bar) return;

            $bar_progress.finaldx = 0;
            bar.progress_changed();
            bar.set_action_completed();
            bar = null;
            $bar_progress = null;
            $bar = null;
        });
    }

    get_all_dependent_tasks(task_id: string): string[] {
        const out: string[] = [];
        const seen = new Set<string>([task_id]);
        const queue = [...(this.dependency_map[task_id] ?? [])];
        while (queue.length) {
            const id = queue.shift()!;
            if (seen.has(id)) continue;
            seen.add(id);
            out.push(id);
            for (const next of this.dependency_map[id] ?? []) {
                if (!seen.has(next)) queue.push(next);
            }
        }
        return out.filter(Boolean);
    }

    get_snap_position(dx: number, ox: number): number {
        let unit_length = 1;
        const default_snap =
            this.options.snap_at || this.config.view_mode.snap_at || '1d';

        if (default_snap !== 'unit') {
            const snapParsed = date_utils.parse_duration(default_snap);
            if (snapParsed) {
                const { duration, scale } = snapParsed;
                unit_length =
                    date_utils.convert_scales(
                        this.config.view_mode.step,
                        scale,
                    ) / duration;
            }
        }

        const rem = dx % (this.config.column_width / unit_length);

        let final_dx =
            dx -
            rem +
            (rem < (this.config.column_width / unit_length) * 2
                ? 0
                : this.config.column_width / unit_length);
        let final_pos = ox + final_dx;

        const drn = final_dx > 0 ? 1 : -1;
        let ignored_regions = this.get_ignored_region(final_pos, drn);
        while (ignored_regions.length) {
            final_pos += this.config.column_width * drn;
            ignored_regions = this.get_ignored_region(final_pos, drn);
            if (!ignored_regions.length)
                final_pos -= this.config.column_width * drn;
        }
        return final_pos - ox;
    }

    get_ignored_region(pos: number, drn = 1): number[] {
        if (drn === 1) {
            return this.config.ignored_positions.filter((val) => {
                return pos > val && pos <= val + this.config.column_width;
            });
        } else {
            return this.config.ignored_positions.filter(
                (val) => pos >= val && pos < val + this.config.column_width,
            );
        }
    }

    unselect_all(): void {
        if (this.popup) this.popup.parent.classList.add('hide');
        this.$container
            .querySelectorAll('.date-range-highlight')
            .forEach((k) => k.classList.add('hide'));
    }

    view_is(modes: string | ViewMode | ViewMode[]): boolean {
        if (typeof modes === 'string') {
            return this.config.view_mode.name === modes;
        }

        if (Array.isArray(modes)) {
            return modes.some((m) => this.view_is(m));
        }

        return this.config.view_mode.name === modes.name;
    }

    get_task(id: string): GanttTaskInternal | undefined {
        return this.tasks.find((task) => {
            return task.id === id;
        });
    }

    get_bar(id: string): Bar | undefined {
        return this.bars.find((bar) => {
            return bar.task.id === id;
        });
    }

    show_popup(opts: PopupShowParams): void {
        if (this.options.popup === false) return;
        const popupFactory = this.options.popup;
        if (typeof popupFactory !== 'function') return;
        if (!this.popup) {
            this.popup = new Popup(
                this.$popup_wrapper,
                popupFactory,
                this,
            );
        }
        this.popup.show(opts);
    }

    hide_popup(): void {
        this.popup && this.popup.hide();
    }

    trigger_event(event: string, args: unknown[]): void {
        const fn = this.options['on_' + event];
        if (typeof fn === 'function') {
            (fn as (...a: unknown[]) => void).apply(this, args);
        }
    }

    /**
     * Gets the oldest starting date from the list of tasks
     *
     * @returns Date
     * @memberof Gantt
     */
    get_oldest_starting_date(): Date {
        if (!this.tasks.length) return new Date();
        const starts = this.tasks.map((task) => task._start);
        return starts.reduce((prev_date, cur_date) =>
            cur_date <= prev_date ? cur_date : prev_date,
        );
    }

    /**
     * Clear all elements from the parent svg element
     *
     * @memberof Gantt
     */
    clear(): void {
        this.$svg.innerHTML = '';
        this.$header?.remove?.();
        this.$side_header?.remove?.();
        this.$current_highlight?.remove?.();
        this.$extras?.remove?.();
        this.popup?.hide?.();
    }
}

Gantt.VIEW_MODE = {
    HOUR: DEFAULT_VIEW_MODES[0],
    QUARTER_DAY: DEFAULT_VIEW_MODES[1],
    HALF_DAY: DEFAULT_VIEW_MODES[2],
    DAY: DEFAULT_VIEW_MODES[3],
    WEEK: DEFAULT_VIEW_MODES[4],
    MONTH: DEFAULT_VIEW_MODES[5],
    YEAR: DEFAULT_VIEW_MODES[6],
};

export type { GanttTask, GanttTaskInternal, GanttOptions } from './types';

function generate_id(task: GanttTask): string {
    return (task.name ?? 'task') + '_' + Math.random().toString(36).slice(2, 12);
}

function sanitize(s: string): string {
    return s.replaceAll(' ', '_').replaceAll(':', '_').replaceAll('.', '_');
}
