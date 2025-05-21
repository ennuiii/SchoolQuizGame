declare module 'fabric' {
  export namespace fabric {
    /**
     * Represents a pattern used for filling shapes or backgrounds.
     * The source can be an image, canvas, or video element.
     */
    export class Pattern {
      constructor(options: {
        /** The source of the pattern. */
        source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | string;
        /** How the pattern should repeat ('repeat', 'repeat-x', 'repeat-y', 'no-repeat'). */
        repeat?: string;
        /** Horizontal offset of the pattern. */
        offsetX?: number;
        /** Vertical offset of the pattern. */
        offsetY?: number;
        /** Cross-origin attribute for the source image if loaded from a URL. */
        crossOrigin?: string | null;
        /** Function to create the pattern source. Useful for custom patterns. */
        patternSourceCanvas?: () => HTMLCanvasElement;
        // Add other known Pattern properties if needed
      });
      // Define other methods and properties of Pattern if you use them
      // e.g., toSVG(fabricCanvas?: fabric.Canvas): string;
      // e.g., initialize(options: any): void;
    }

    /**
     * Base class for all visual objects on the Fabric canvas.
     */
    export class Object {
      /** Type of the Fabric object (e.g., 'rect', 'circle', 'image', 'path'). */
      type: string;
      /** When set to `false`, an object can not be selected as target. */
      selectable?: boolean;
      /** When set to `false`, an object can not be a target of events. */
      evented?: boolean;
      /** Left position of an object. */
      left?: number;
      /** Top position of an object. */
      top?: number;
      /** Width of an object. */
      width?: number;
      /** Height of an object. */
      height?: number;
      /** Fill color or pattern of an object. */
      fill?: string | Pattern | null;
      /** Stroke color of an object. */
      stroke?: string | null;
      /** Stroke width of an object. */
      strokeWidth?: number;
      /** When true, object horizontal movement is locked */
      lockMovementX?: boolean;
      /** When true, object vertical movement is locked */
      lockMovementY?: boolean;
      /** When false, object controls (resize/rotate) are hidden */
      hasControls?: boolean;
      /** When false, object borders are hidden */
      hasBorders?: boolean;
      /** Scale factor for the object in the X direction. */
      scaleX?: number;
      /** Scale factor for the object in the Y direction. */
      scaleY?: number;
      /** Angle of rotation for the object. */
      angle?: number;
      /** Origin point for scaling and rotation. */
      originX?: string;
      /** Origin point for scaling and rotation. */
      originY?: string;
      
      // Add more common Object properties as needed
      // constructor(options?: any);

      /** Removes object from canvas to which it was added. */
      remove(): this;
      /** Returns an object representation of an instance */
      toObject(propertiesToInclude?: string[]): any;
      /** Returns svg representation of an instance */
      toSVG(reviver?: (svg: string) => string): string;
      // Common method to get scaled dimensions
      getScaledWidth?(): number;
      getScaledHeight?(): number;
      // Add getBoundingRect
      getBoundingRect(absolute?: boolean, withoutTransformations?: boolean): { left: number; top: number; width: number; height: number; };
      // ... other common methods
    }

    /**
     * Represents the Fabric.js canvas, the main surface for drawing and interaction.
     */
    export class Canvas {
      /**
       * Constructor
       * @param el <canvas> element to initialize instance on
       * @param {Object} [options] Options object
       */
      constructor(el: HTMLCanvasElement | string, options?: any);

      /** Indicates whether the canvas is in drawing mode. */
      isDrawingMode: boolean;
      /** The free drawing brush instance. */
      freeDrawingBrush: any; // You can type this more strictly, e.g., fabric.BaseBrush
      /** * Background color or pattern of the canvas.
       * Can be a color string (e.g., 'red', '#FF0000') or a fabric.Pattern instance.
       */
      backgroundColor: string | Pattern | null;
      /** Width of the canvas. */
      width: number;
      /** Height of the canvas. */
      height: number;
      /** Indicates whether object selection is enabled. */
      selection: boolean;
      /** When true, canvas doesn't process events on objects */
      skipTargetFind: boolean;
      /** When true, objects remain in their current stacking order when selected */
      preserveObjectStacking: boolean;
      /** * Background image of the canvas.
       * Can be a fabric.Image instance or a fabric.Pattern instance.
       */
      backgroundImage: fabric.Image | Pattern | null; // More specific type

      /** Renders all objects and the background on the canvas. */
      renderAll(): void;
      /** Clears the canvas (removes all objects and background). */
      clear(): this;
      /** Disposes of the canvas, freeing up resources. */
      dispose(): this;
      /** * Returns the SVG representation of the canvas.
       * @param [options] Options object for SVG export.
       * @param [reviver] Method for further parsing of svg elements, called after each fabric object converted into svg representation.
       */
      toSVG(options?: any, reviver?: (svg: string) => string): string;
      /** * Adds an event listener to the canvas.
       * @param eventName Name of the event (e.g., 'mouse:down', 'object:added').
       * @param callback Function to execute when the event is triggered.
       */
      on(eventName: string, callback: (event: IEvent) => void): void; // IEvent can be typed more specifically
      // Overload for specific events if needed, e.g.:
      // on(eventName: 'mouse:down', callback: (event: { e: MouseEvent; target?: fabric.Object }) => void): void;

      /** Returns an array of all objects on the canvas. */
      getObjects(type?: string): fabric.Object[];
      /** Removes one or more objects from the canvas. */
      remove(...object: fabric.Object[]): this;
      /** Adds objects to the canvas. */
      add(...object: fabric.Object[]): this;
      /** Executes a callback for each object on the canvas. */
      forEachObject(
        callback: (obj: fabric.Object, index: number, array: fabric.Object[]) => void,
        context?: any
      ): void;
      // Add other Canvas methods and properties as needed
    }

    /**
     * Represents an image object in Fabric.js.
     */
    export class Image extends Object {
        constructor(element: HTMLImageElement | HTMLVideoElement | string, options?: any);
        // Add Image specific properties and methods
        getElement(): HTMLImageElement | HTMLVideoElement;
        setElement(element: HTMLImageElement | HTMLVideoElement, options?: any): this;
        // ...
    }
    
    /**
     * Interface for Fabric event objects.
     */
    export interface IEvent {
        e: Event; // Native browser event
        target?: fabric.Object | null; // Target of the event (if any)
        currentTarget?: fabric.Object | null;
        subTargets?: fabric.Object[];
        button?: number; // Mouse button
        isClick?: boolean;
        pointer?: fabric.Point;
        absolutePointer?: fabric.Point;
        transform?: any; // Transform data
        // Add other common event properties
    }

    /**
     * Represents a 2D point.
     */
    export class Point {
        x: number;
        y: number;
        constructor(x: number, y: number);
        // Add Point methods if needed (e.g., add, subtract, eq)
    }


    /**
     * Namespace for utility functions in Fabric.js.
     */
    export namespace util {
      /**
       * Loads an image from a URL.
       * @param url URL of the image to load.
       * @param callback Callback function executed when the image is loaded or fails to load.
       * @param context Context for the callback function.
       * @param options Options object, e.g., for crossOrigin.
       */
      export function loadImage(
        url: string,
        callback: (img: HTMLImageElement | null, isError?: boolean) => void,
        context?: any,
        options?: { crossOrigin?: string | null }
      ): void;

      // Add other fabric.util functions if you use them
      // e.g., export functionenlivenObjects(...): void;
      // e.g., export functionenlivenPatterns(...): void;
    }

    /**
     * Parses an SVG string and loads it onto the canvas.
     * @param string The SVG string to parse.
     * @param callback Callback function executed after parsing, receiving an array of objects and options.
     * @param reviver Optional function to manipulate objects after they are created from SVG elements.
     */
    export function loadSVGFromString(
      string: string,
      callback: (objects: fabric.Object[], options: any) => void,
      reviver?: (element: SVGElement, object: fabric.Object) => void
    ): void;

    // Add other Fabric classes/namespaces if needed (e.g., fabric.Rect, fabric.Circle, fabric.Text, fabric.BaseBrush)
  }
}


