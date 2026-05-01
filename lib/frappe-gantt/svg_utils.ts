import './svg_augment';

/** SVG attrs for createSVG: arbitrary attributes plus Element parents (not serializable attrs). */
export type SVGAttrs = {
    append_to?: Element;
    innerHTML?: string;
    clipPath?: string;
} & Record<string, string | number | boolean | Element | undefined>;

type DelegateCallback = (e: MouseEvent, delegatedTarget: Element) => void;

export interface DollarHelper {
    (expr: string | Element | null, con?: Document | Element | null): Element | null;
    on(
        element: EventTarget,
        event: string,
        selector: string | DelegateCallback,
        callback?: DelegateCallback,
    ): void;
    off(element: EventTarget, event: string, handler: EventListener): void;
    bind(element: EventTarget, event: string, callback: EventListener): void;
    delegate(
        element: HTMLElement,
        event: string,
        selector: string,
        callback: DelegateCallback,
    ): void;
    closest(selector: string, element: Element | null): Element | null;
    attr(
        element: Element,
        attr: string | Record<string, string | number>,
        value?: string | number,
    ): string | null | void;
}

function query(
    expr: string | Element | null,
    con?: Document | Element | null,
): Element | null {
    if (typeof expr === 'string') {
        return (con ?? document).querySelector(expr);
    }
    return expr ?? null;
}

export function createSVG(tag: string, attrs: SVGAttrs): SVGElement {
    const elem = document.createElementNS(
        'http://www.w3.org/2000/svg',
        tag,
    ) as SVGElement;
    for (const attr in attrs) {
        if (attr === 'append_to') {
            const parent = attrs.append_to;
            if (parent) parent.appendChild(elem);
        } else if (attr === 'innerHTML') {
            elem.innerHTML = attrs.innerHTML ?? '';
        } else if (attr === 'clipPath') {
            elem.setAttribute('clip-path', 'url(#' + attrs[attr] + ')');
        } else {
            const v = attrs[attr];
            if (v !== undefined) {
                elem.setAttribute(attr, String(v));
            }
        }
    }
    return elem;
}

export function animateSVG(
    svgElement: SVGElement,
    attr: string,
    from: number,
    to: number,
): void {
    const animatedSvgElement = getAnimationElement(svgElement, attr, from, to);

    if (animatedSvgElement === svgElement) {
        const event = document.createEvent('HTMLEvents');
        event.initEvent('click', true, true);
        (event as Event & { eventName?: string }).eventName = 'click';
        animatedSvgElement.dispatchEvent(event);
    }
}

function getAnimationElement(
    svgElement: SVGElement,
    attr: string,
    from: number,
    to: number,
    dur = '0.4s',
    begin = '0.1s',
): SVGElement {
    const animEl = svgElement.querySelector('animate');
    if (animEl) {
        Dollar.attr(animEl, {
            attributeName: attr,
            from,
            to,
            dur,
            begin: 'click + ' + begin,
        });
        return svgElement;
    }

    const animateElement = createSVG('animate', {
        attributeName: attr,
        from,
        to,
        dur,
        begin,
        calcMode: 'spline',
        values: from + ';' + to,
        keyTimes: '0; 1',
        keySplines: cubic_bezier('ease-out'),
    });
    svgElement.appendChild(animateElement);

    return svgElement;
}

function cubic_bezier(name: keyof typeof BEZIER): string {
    return BEZIER[name];
}

const BEZIER = {
    ease: '.25 .1 .25 1',
    linear: '0 0 1 1',
    'ease-in': '.42 0 1 1',
    'ease-out': '0 0 .58 1',
    'ease-in-out': '.42 0 .58 1',
} as const;

const Dollar = Object.assign(query, {
    on(
        element: EventTarget,
        event: string,
        selector: string | DelegateCallback,
        callback?: DelegateCallback,
    ): void {
        if (!callback) {
            Dollar.bind(element as HTMLElement, event, selector as EventListener);
        } else {
            Dollar.delegate(
                element as HTMLElement,
                event,
                selector as string,
                callback,
            );
        }
    },

    off(element: EventTarget, event: string, handler: EventListener): void {
        element.removeEventListener(event, handler);
    },

    bind(element: EventTarget, event: string, callback: EventListener): void {
        event.split(/\s+/).forEach((ev) => {
            element.addEventListener(ev, callback);
        });
    },

    delegate(
        element: HTMLElement,
        event: string,
        selector: string,
        callback: DelegateCallback,
    ): void {
        element.addEventListener(event, function (this: HTMLElement, e: Event) {
            const me = e as MouseEvent & { delegatedTarget?: Element };
            const t = me.target;
            if (!(t instanceof Element)) return;
            const delegatedTarget = t.closest(selector);
            if (delegatedTarget) {
                me.delegatedTarget = delegatedTarget;
                callback.call(this, me, delegatedTarget);
            }
        });
    },

    closest(selector: string, element: Element | null): Element | null {
        if (!element) return null;
        if (element.matches(selector)) {
            return element;
        }
        return Dollar.closest(selector, element.parentElement);
    },

    attr(
        element: Element,
        attr: string | Record<string, string | number>,
        value?: string | number,
    ): string | null | void {
        if (value === undefined && typeof attr === 'string') {
            return element.getAttribute(attr);
        }

        if (typeof attr === 'object') {
            for (const key in attr) {
                Dollar.attr(element, key, attr[key] as string | number);
            }
            return;
        }

        element.setAttribute(attr, String(value));
    },
}) as DollarHelper;

export const $ = Dollar;
