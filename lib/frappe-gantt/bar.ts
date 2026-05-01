import date_utils from './date_utils';
import { $, createSVG, animateSVG } from './svg_utils';
import type { GanttTaskInternal } from './types';
import type Gantt from './index';
import type Arrow from './arrow';

export default class Bar {
    action_completed = false;
    gantt!: Gantt;
    task!: GanttTaskInternal;
    name = '';
    group!: SVGGElement;
    bar_group!: SVGGElement;
    handle_group!: SVGGElement;
    invalid?: boolean;
    height!: number;
    image_size!: number;
    corner_radius!: number;
    x!: number;
    y!: number;
    width!: number;
    duration!: number;
    actual_duration_raw!: number;
    ignored_duration_raw!: number;
    progress_width!: number;
    expected_progress!: number;
    expected_progress_width!: number;
    handles: SVGElement[] = [];
    arrows: Arrow[] = [];

    $bar!: SVGElement;
    $bar_progress!: SVGElement;
    $expected_bar_progress!: SVGElement;
    $handle_progress!: SVGElement | undefined;
    $date_highlight?: HTMLElement;

    constructor(gantt: Gantt, task: GanttTaskInternal) {
        this.set_defaults(gantt, task);
        this.prepare_wrappers();
        this.prepare_helpers();
        this.refresh();
    }

    refresh(): void {
        this.bar_group.innerHTML = '';
        this.handle_group.innerHTML = '';
        if (this.task.custom_class) {
            this.group.classList.add(this.task.custom_class);
        } else {
            this.group.setAttribute('class', 'bar-wrapper');
        }

        this.prepare_values();
        this.draw();
        this.bind();
    }

    set_defaults(gantt: Gantt, task: GanttTaskInternal): void {
        this.action_completed = false;
        this.gantt = gantt;
        this.task = task;
        this.name = this.name || '';
    }

    prepare_wrappers(): void {
        this.group = createSVG('g', {
            class:
                'bar-wrapper' +
                (this.task.custom_class ? ' ' + this.task.custom_class : ''),
            'data-id': this.task.id,
        }) as SVGGElement;
        this.bar_group = createSVG('g', {
            class: 'bar-group',
            append_to: this.group,
        }) as SVGGElement;
        this.handle_group = createSVG('g', {
            class: 'handle-group',
            append_to: this.group,
        }) as SVGGElement;
    }

    prepare_values(): void {
        this.invalid = this.task.invalid;
        const bh = this.gantt.options.bar_height;
        this.height = typeof bh === 'number' ? bh : 30;
        this.image_size = this.height - 5;
        this.task._start = new Date(this.task.start as Date);
        this.task._end = new Date(this.task.end as Date);
        this.compute_x();
        this.compute_y();
        this.compute_duration();
        this.corner_radius = this.gantt.options.bar_corner_radius as number;
        this.width = this.gantt.config.column_width * this.duration;
        if (!this.task.progress || this.task.progress < 0) this.task.progress = 0;
        if (this.task.progress > 100) this.task.progress = 100;
    }

    prepare_helpers(): void {
        SVGElement.prototype.getX = function (this: SVGElement) {
            return +this.getAttribute('x')!;
        };
        SVGElement.prototype.getY = function (this: SVGElement) {
            return +this.getAttribute('y')!;
        };
        SVGElement.prototype.getWidth = function (this: SVGElement) {
            return +this.getAttribute('width')!;
        };
        SVGElement.prototype.getHeight = function (this: SVGElement) {
            return +this.getAttribute('height')!;
        };
        SVGElement.prototype.getEndX = function (this: SVGElement) {
            return this.getX() + this.getWidth();
        };
    }

    prepare_expected_progress_values(): void {
        this.compute_expected_progress();
        this.expected_progress_width =
            (this.gantt.options.column_width ?? this.gantt.config.column_width) *
                this.duration *
                (this.expected_progress / 100) || 0;
    }

    draw(): void {
        this.draw_bar();
        this.draw_progress_bar();
        if (this.gantt.options.show_expected_progress) {
            this.prepare_expected_progress_values();
            this.draw_expected_progress_bar();
        }
        this.draw_label();
        this.draw_resize_handles();

        if (this.task.thumbnail) {
            this.draw_thumbnail();
        }
    }

    draw_bar(): void {
        this.$bar = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'bar',
            append_to: this.bar_group,
        });
        if (this.task.color) this.$bar.style.fill = String(this.task.color);
        animateSVG(this.$bar, 'width', 0, this.width);

        if (this.invalid) {
            this.$bar.classList.add('bar-invalid');
        }
    }

    draw_expected_progress_bar(): void {
        if (this.invalid) return;
        this.$expected_bar_progress = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.expected_progress_width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'bar-expected-progress',
            append_to: this.bar_group,
        });

        animateSVG(
            this.$expected_bar_progress,
            'width',
            0,
            this.expected_progress_width,
        );
    }

    draw_progress_bar(): void {
        if (this.invalid) return;
        this.progress_width = this.calculate_progress_width();
        let r = this.corner_radius;
        if (!/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
            r = this.corner_radius + 2;
        this.$bar_progress = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.progress_width,
            height: this.height,
            rx: r,
            ry: r,
            class: 'bar-progress',
            append_to: this.bar_group,
        });
        if (this.task.color_progress)
            this.$bar_progress.style.fill = String(this.task.color_progress);
        const x =
            (date_utils.diff(
                this.task._start,
                this.gantt.gantt_start,
                this.gantt.config.unit,
            ) /
                this.gantt.config.step) *
            this.gantt.config.column_width;

        const $date_highlight = this.gantt.create_el({
            classes: 'date-range-highlight hide',
            width: this.width,
            left: x,
        });
        this.$date_highlight = $date_highlight;
        this.gantt.$lower_header.prepend(this.$date_highlight);

        animateSVG(this.$bar_progress, 'width', 0, this.progress_width);
    }

    calculate_progress_width(): number {
        const width = this.$bar.getWidth();
        const ignored_end = this.x + width;
        const total_ignored_area =
            this.gantt.config.ignored_positions.reduce((acc, val) => {
                return acc + (val >= this.x && val < ignored_end ? 1 : 0);
            }, 0) * this.gantt.config.column_width;
        let progress_width =
            ((width - total_ignored_area) * (this.task.progress ?? 0)) / 100;
        const progress_end = this.x + progress_width;
        const total_ignored_progress =
            this.gantt.config.ignored_positions.reduce((acc, val) => {
                return acc + (val >= this.x && val < progress_end ? 1 : 0);
            }, 0) * this.gantt.config.column_width;

        progress_width += total_ignored_progress;

        let ignored_regions = this.gantt.get_ignored_region(
            this.x + progress_width,
        );

        while (ignored_regions.length) {
            progress_width += this.gantt.config.column_width;
            ignored_regions = this.gantt.get_ignored_region(
                this.x + progress_width,
            );
        }
        this.progress_width = progress_width;
        return progress_width;
    }

    draw_label(): void {
        let x_coord = this.x + this.$bar.getWidth() / 2;

        if (this.task.thumbnail) {
            x_coord = this.x + this.image_size + 5;
        }

        createSVG('text', {
            x: x_coord,
            y: this.y + this.height / 2,
            innerHTML: this.task.name,
            class: 'bar-label',
            append_to: this.bar_group,
        });
        requestAnimationFrame(() => this.update_label_position());
    }

    draw_thumbnail(): void {
        const x_offset = 10;
        const y_offset = 2;

        const defs = createSVG('defs', {
            append_to: this.bar_group,
        });

        createSVG('rect', {
            id: 'rect_' + this.task._index,
            x: this.x + x_offset,
            y: this.y + y_offset,
            width: this.image_size,
            height: this.image_size,
            rx: '15',
            class: 'img_mask',
            append_to: defs,
        });

        const clipPath = createSVG('clipPath', {
            id: 'clip_' + this.task._index,
            append_to: defs,
        });

        createSVG('use', {
            href: '#rect_' + this.task._index,
            append_to: clipPath,
        });

        createSVG('image', {
            x: this.x + x_offset,
            y: this.y + y_offset,
            width: this.image_size,
            height: this.image_size,
            class: 'bar-img',
            href: this.task.thumbnail,
            clipPath: 'clip_' + this.task._index,
            append_to: this.bar_group,
        });
    }

    draw_resize_handles(): void {
        if (this.invalid || this.gantt.options.readonly) return;

        const bar = this.$bar;
        const handle_width = 3;
        this.handles = [];
        if (!this.gantt.options.readonly_dates) {
            this.handles.push(
                createSVG('rect', {
                    x: bar.getEndX() - handle_width / 2,
                    y: bar.getY() + this.height / 4,
                    width: handle_width,
                    height: this.height / 2,
                    rx: 2,
                    ry: 2,
                    class: 'handle right',
                    append_to: this.handle_group,
                }),
            );

            this.handles.push(
                createSVG('rect', {
                    x: bar.getX() - handle_width / 2,
                    y: bar.getY() + this.height / 4,
                    width: handle_width,
                    height: this.height / 2,
                    rx: 2,
                    ry: 2,
                    class: 'handle left',
                    append_to: this.handle_group,
                }),
            );
        }
        if (!this.gantt.options.readonly_progress) {
            const bar_progress = this.$bar_progress;
            this.$handle_progress = createSVG('circle', {
                cx: bar_progress.getEndX(),
                cy: bar_progress.getY() + bar_progress.getHeight() / 2,
                r: 4.5,
                class: 'handle progress',
                append_to: this.handle_group,
            });
            this.handles.push(this.$handle_progress);
        }

        for (const handle of this.handles) {
            $.on(handle, 'mouseenter', () => handle.classList.add('active'));
            $.on(handle, 'mouseleave', () =>
                handle.classList.remove('active'),
            );
        }
    }

    bind(): void {
        if (this.invalid) return;
        this.setup_click_event();
    }

    setup_click_event(): void {
        $.on(this.group, 'mouseover', (e: MouseEvent) => {
            this.gantt.trigger_event('hover', [
                this.task,
                e.screenX,
                e.screenY,
                e,
            ]);
        });

        if (this.gantt.options.popup_on === 'click') {
            $.on(this.group, 'mouseup', (e: MouseEvent) => {
                const posX =
                    e.offsetX ||
                    (e as MouseEvent & { layerX?: number }).layerX ||
                    0;
                if (this.$handle_progress) {
                    const cx = +this.$handle_progress.getAttribute('cx')!;
                    if (cx > posX - 1 && cx < posX + 1) return;
                    if (this.gantt.bar_being_dragged) return;
                }
                this.gantt.show_popup({
                    x:
                        e.offsetX ||
                        (e as MouseEvent & { layerX?: number }).layerX ||
                        0,
                    y:
                        e.offsetY ||
                        (e as MouseEvent & { layerY?: number }).layerY ||
                        0,
                    task: this.task,
                    target: this.$bar,
                });
            });
        }
        let timeout: ReturnType<typeof setTimeout>;
        $.on(this.group, 'mouseenter', (e: MouseEvent) => {
            timeout = setTimeout(() => {
                if (this.gantt.options.popup_on === 'hover')
                    this.gantt.show_popup({
                        x:
                            e.offsetX ||
                            (e as MouseEvent & { layerX?: number }).layerX ||
                            0,
                        y:
                            e.offsetY ||
                            (e as MouseEvent & { layerY?: number }).layerY ||
                            0,
                        task: this.task,
                        target: this.$bar,
                    });
                this.$date_highlight?.classList.remove('hide');
            }, 200);
        });
        $.on(this.group, 'mouseleave', () => {
            clearTimeout(timeout);
            if (this.gantt.options.popup_on === 'hover')
                this.gantt.popup?.hide?.();
            this.$date_highlight?.classList.add('hide');
        });

        $.on(this.group, 'click', () => {
            this.gantt.trigger_event('click', [this.task]);
        });

        $.on(this.group, 'dblclick', () => {
            if (this.action_completed) {
                return;
            }
            this.group.classList.remove('active');
            if (this.gantt.popup)
                this.gantt.popup.parent.classList.remove('hide');

            this.gantt.trigger_event('double_click', [this.task]);
        });
        let tapedTwice = false;
        $.on(this.group, 'touchstart', (e: Event) => {
            if (!tapedTwice) {
                tapedTwice = true;
                setTimeout(function () {
                    tapedTwice = false;
                }, 300);
                return;
            }
            e.preventDefault();

            if (this.action_completed) {
                return;
            }
            this.group.classList.remove('active');
            if (this.gantt.popup)
                this.gantt.popup.parent.classList.remove('hide');

            this.gantt.trigger_event('double_click', [this.task]);
        });
    }

    update_bar_position({
        x = null,
        width = null,
    }: {
        x?: number | null;
        width?: number | null;
    }): void {
        const bar = this.$bar;

        if (x) {
            if (this.gantt.options.restrict_drag_by_dependencies) {
                const xs = this.task.dependencies
                    .map((dep) => this.gantt.get_bar(dep))
                    .filter((b): b is Bar => !!b)
                    .map((b) => b.$bar.getX());
                const valid_x = xs.reduce((prev, curr) => {
                    return prev && x >= curr;
                }, true);
                if (!valid_x) return;
            }
            this.update_attr(bar, 'x', x);
            this.x = x;
            if (this.$date_highlight)
                this.$date_highlight.style.left = x + 'px';
        }
        if (width && width > 0) {
            this.update_attr(bar, 'width', width);
            if (this.$date_highlight)
                this.$date_highlight.style.width = width + 'px';
        }

        this.update_label_position();
        this.update_handle_position();
        this.compute_duration();

        if (this.gantt.options.show_expected_progress) {
            this.update_expected_progressbar_position();
        }

        this.update_progressbar_position();
        this.update_arrow_position();
    }

    update_label_position_on_horizontal_scroll({
        x,
        sx,
    }: {
        x: number;
        sx: number;
    }): void {
        const container = this.gantt.$container;
        const label = this.group.querySelector('.bar-label') as SVGElement | null;
        const img = this.group.querySelector('.bar-img') as SVGElement | null;
        const img_mask = this.bar_group.querySelector('.img_mask') as SVGElement | null;
        if (!label) return;

        const barWidthLimit = this.$bar.getX() + this.$bar.getWidth();
        const newLabelX = label.getX() + x;
        const newImgX = img ? img.getX() + x : 0;
        const imgWidth = img
            ? (img as SVGGraphicsElement).getBBox().width + 7
            : 7;
        const labelEndX =
            newLabelX + (label as SVGGraphicsElement).getBBox().width + 7;
        const viewportCentral = sx + container.clientWidth / 2;

        if (label.classList.contains('big')) return;

        if (labelEndX < barWidthLimit && x > 0 && labelEndX < viewportCentral) {
            label.setAttribute('x', String(newLabelX));
            if (img && img_mask) {
                img.setAttribute('x', String(newImgX));
                img_mask.setAttribute('x', String(newImgX));
            }
        } else if (
            newLabelX - imgWidth > this.$bar.getX() &&
            x < 0 &&
            labelEndX > viewportCentral
        ) {
            label.setAttribute('x', String(newLabelX));
            if (img && img_mask) {
                img.setAttribute('x', String(newImgX));
                img_mask.setAttribute('x', String(newImgX));
            }
        }
    }

    date_changed(): void {
        let changed = false;
        const { new_start_date, new_end_date } = this.compute_start_end_date();
        if (Number(this.task._start) !== Number(new_start_date)) {
            changed = true;
            this.task._start = new_start_date;
        }

        if (Number(this.task._end) !== Number(new_end_date)) {
            changed = true;
            this.task._end = new_end_date;
        }

        if (!changed) return;

        this.gantt.trigger_event('date_change', [
            this.task,
            new_start_date,
            date_utils.add(new_end_date, -1, 'second'),
        ]);
    }

    progress_changed(): void {
        this.task.progress = this.compute_progress();
        this.gantt.trigger_event('progress_change', [
            this.task,
            this.task.progress,
        ]);
    }

    set_action_completed(): void {
        this.action_completed = true;
        setTimeout(() => (this.action_completed = false), 1000);
    }

    compute_start_end_date(): { new_start_date: Date; new_end_date: Date } {
        const bar = this.$bar;
        const x_in_units = bar.getX() / this.gantt.config.column_width;
        const new_start_date = date_utils.add(
            this.gantt.gantt_start,
            x_in_units * this.gantt.config.step,
            this.gantt.config.unit,
        );

        const width_in_units = bar.getWidth() / this.gantt.config.column_width;
        const new_end_date = date_utils.add(
            new_start_date,
            width_in_units * this.gantt.config.step,
            this.gantt.config.unit,
        );

        return { new_start_date, new_end_date };
    }

    compute_progress(): number {
        this.progress_width = this.$bar_progress.getWidth();
        this.x = (this.$bar_progress as SVGGraphicsElement).getBBox().x;
        const progress_area = this.x + this.progress_width;
        const progress =
            this.progress_width -
            this.gantt.config.ignored_positions.reduce((acc, val) => {
                return acc + (val >= this.x && val <= progress_area ? 1 : 0);
            }, 0) *
                this.gantt.config.column_width;
        if (progress < 0) return 0;
        const total =
            this.$bar.getWidth() -
            this.ignored_duration_raw * this.gantt.config.column_width;
        return parseInt(String((progress / total) * 100), 10);
    }

    compute_expected_progress(): void {
        this.expected_progress =
            date_utils.diff(date_utils.today(), this.task._start, 'hour') /
            this.gantt.config.step;
        this.expected_progress =
            ((this.expected_progress < this.duration
                ? this.expected_progress
                : this.duration) *
                100) /
            this.duration;
    }

    compute_x(): void {
        const { column_width } = this.gantt.config;
        const task_start = this.task._start;
        const gantt_start = this.gantt.gantt_start;

        const diff =
            date_utils.diff(task_start, gantt_start, this.gantt.config.unit) /
            this.gantt.config.step;

        this.x = diff * column_width;
    }

    compute_y(): void {
        const pad = this.gantt.options.padding ?? 18;
        this.y =
            this.gantt.config.header_height +
            pad / 2 +
            this.task._index * (this.height + pad);
    }

    compute_duration(): void {
        let actual_duration_in_days = 0;
        let duration_in_days = 0;
        for (
            let d = new Date(this.task._start);
            d < this.task._end;
            d.setDate(d.getDate() + 1)
        ) {
            duration_in_days++;
            if (
                !this.gantt.config.ignored_dates.find(
                    (k) => k.getTime() === d.getTime(),
                ) &&
                (!this.gantt.config.ignored_function ||
                    !this.gantt.config.ignored_function(d))
            ) {
                actual_duration_in_days++;
            }
        }
        (this.task as GanttTaskInternal & { actual_duration?: number }).actual_duration =
            actual_duration_in_days;
        (this.task as GanttTaskInternal & { ignored_duration?: number }).ignored_duration =
            duration_in_days - actual_duration_in_days;

        this.duration =
            date_utils.convert_scales(
                duration_in_days + 'd',
                this.gantt.config.unit,
            ) / this.gantt.config.step;

        this.actual_duration_raw =
            date_utils.convert_scales(
                actual_duration_in_days + 'd',
                this.gantt.config.unit,
            ) / this.gantt.config.step;

        this.ignored_duration_raw = this.duration - this.actual_duration_raw;
    }

    update_attr(
        element: SVGElement,
        attr: string,
        value: number | string | null,
    ): SVGElement {
        const n = +value!;
        if (!isNaN(n)) {
            element.setAttribute(attr, String(n));
        }
        return element;
    }

    update_expected_progressbar_position(): void {
        if (this.invalid) return;
        this.$expected_bar_progress.setAttribute('x', String(this.$bar.getX()));
        this.compute_expected_progress();
        this.$expected_bar_progress.setAttribute(
            'width',
            String(
                this.gantt.config.column_width *
                    this.actual_duration_raw *
                    (this.expected_progress / 100) || 0,
            ),
        );
    }

    update_progressbar_position(): void {
        if (this.invalid || this.gantt.options.readonly) return;
        this.$bar_progress.setAttribute('x', String(this.$bar.getX()));

        this.$bar_progress.setAttribute(
            'width',
            String(this.calculate_progress_width()),
        );
    }

    update_label_position(): void {
        const img_mask = this.bar_group.querySelector('.img_mask') as SVGElement | null;
        const bar = this.$bar;
        const label = this.group.querySelector('.bar-label') as SVGElement | null;
        const img = this.group.querySelector('.bar-img') as SVGElement | null;
        if (!label) return;

        const padding = 5;
        const x_offset_label_img = this.image_size + 10;
        const labelWidth = (label as SVGGraphicsElement).getBBox().width;
        const barWidth = bar.getWidth();
        if (labelWidth > barWidth) {
            label.classList.add('big');
            if (img && img_mask) {
                img.setAttribute('x', String(bar.getEndX() + padding));
                img_mask.setAttribute('x', String(bar.getEndX() + padding));
                label.setAttribute(
                    'x',
                    String(bar.getEndX() + x_offset_label_img),
                );
            } else {
                label.setAttribute('x', String(bar.getEndX() + padding));
            }
        } else {
            label.classList.remove('big');
            if (img && img_mask) {
                img.setAttribute('x', String(bar.getX() + padding));
                img_mask.setAttribute('x', String(bar.getX() + padding));
                label.setAttribute(
                    'x',
                    String(bar.getX() + barWidth / 2 + x_offset_label_img),
                );
            } else {
                label.setAttribute(
                    'x',
                    String(bar.getX() + barWidth / 2 - labelWidth / 2),
                );
            }
        }
    }

    update_handle_position(): void {
        if (this.invalid || this.gantt.options.readonly) return;
        const bar = this.$bar;
        const left = this.handle_group.querySelector(
            '.handle.left',
        ) as SVGElement | null;
        const right = this.handle_group.querySelector(
            '.handle.right',
        ) as SVGElement | null;
        left?.setAttribute('x', String(bar.getX()));
        right?.setAttribute('x', String(bar.getEndX()));
        const handle = this.group.querySelector(
            '.handle.progress',
        ) as SVGElement | null;
        if (handle) {
            handle.setAttribute('cx', String(this.$bar_progress.getEndX()));
        }
    }

    update_arrow_position(): void {
        for (const arrow of this.arrows) {
            arrow.update();
        }
    }
}
