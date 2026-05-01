import type Gantt from './index';
import type {
    GanttTaskInternal,
    PopupFactory,
    PopupShowParams,
} from './types';

export default class Popup {
    parent: HTMLElement;
    popup_func: PopupFactory;
    gantt: Gantt;
    title!: HTMLElement | null;
    subtitle!: HTMLElement | null;
    details!: HTMLElement | null;
    actions!: HTMLElement | null;

    constructor(parent: HTMLElement, popup_func: PopupFactory, gantt: Gantt) {
        this.parent = parent;
        this.popup_func = popup_func;
        this.gantt = gantt;

        this.make();
    }

    make(): void {
        this.parent.innerHTML = `
            <div class="title"></div>
            <div class="subtitle"></div>
            <div class="details"></div>
            <div class="actions"></div>
        `;
        this.hide();

        this.title = this.parent.querySelector('.title');
        this.subtitle = this.parent.querySelector('.subtitle');
        this.details = this.parent.querySelector('.details');
        this.actions = this.parent.querySelector('.actions');
    }

    show({ x, y, task, target }: PopupShowParams): void {
        if (!this.actions) return;
        this.actions.innerHTML = '';
        const html = this.popup_func({
            task,
            chart: this.gantt,
            get_title: () => this.title,
            set_title: (title: string) => {
                if (this.title) this.title.innerHTML = title;
            },
            get_subtitle: () => this.subtitle,
            set_subtitle: (subtitle: string) => {
                if (this.subtitle) this.subtitle.innerHTML = subtitle;
            },
            get_details: () => this.details,
            set_details: (details: string) => {
                if (this.details) this.details.innerHTML = details;
            },
            add_action: (htmlFrag, func) => {
                const action = this.gantt.create_el({
                    classes: 'action-btn',
                    type: 'button',
                    append_to: this.actions!,
                });
                const h =
                    typeof htmlFrag === 'function' ? htmlFrag(task) : htmlFrag;
                action.innerHTML = h;
                action.onclick = (ev: MouseEvent) =>
                    func(task, this.gantt, ev);
            },
        });
        if (html === false) return;
        if (html) this.parent.innerHTML = html;

        if (this.actions.innerHTML === '') this.actions.remove();
        else this.parent.appendChild(this.actions);

        this.parent.style.left = x + 10 + 'px';
        this.parent.style.top = y - 10 + 'px';
        this.parent.classList.remove('hide');
    }

    hide(): void {
        this.parent.classList.add('hide');
    }
}
