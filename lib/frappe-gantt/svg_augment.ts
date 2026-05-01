/** Prototype helpers attached in Bar.prepare_helpers — global for SVG rects/text */
export {};

declare global {
    interface SVGElement {
        getX(): number;
        getY(): number;
        getWidth(): number;
        getHeight(): number;
        getEndX(): number;
        /** Drag/resize helpers set on bar rects and progress handles */
        ox?: number;
        oy?: number;
        owidth?: number;
        finaldx?: number;
        min_dx?: number;
        max_dx?: number;
    }

    /** Legacy offset aliases used by Frappe Gantt event handlers */
    interface MouseEvent {
        layerX?: number;
        layerY?: number;
    }
}
