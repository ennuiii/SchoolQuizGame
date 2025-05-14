declare module 'fabric' {
  export namespace fabric {
    export class Canvas {
      constructor(el: HTMLCanvasElement | string, options?: any);
      isDrawingMode: boolean;
      freeDrawingBrush: any;
      backgroundColor: string;
      width: number;
      height: number;
      selection: boolean;
      backgroundImage: any;
      renderAll(): void;
      clear(): void;
      dispose(): void;
      toSVG(): string;
      on(event: string, callback: (...args: any[]) => void): void;
      getObjects(): any[];
      remove(object: any): void;
      forEachObject(callback: (obj: any) => void): void;
      add(object: any): void;
    }

    export function loadSVGFromString(
      string: string,
      callback: (objects: any[], options: any) => void,
      reviver?: (group: any, obj: any) => void
    ): void;
  }
} 