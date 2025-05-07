/// <reference types="react-scripts" />

declare module '*.svg' {
  import * as React from 'react';
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.jpg';
declare module '*.png';
declare module '*.mp3';
declare module '*.wav';

declare namespace React {
  type FC<P = {}> = FunctionComponent<P>;
  interface FunctionComponent<P = {}> {
    (props: P, context?: any): ReactElement<any, any> | null;
  }
  type ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> = {
    type: T;
    props: P;
    key: Key | null;
  };
  type Key = string | number;
  type JSXElementConstructor<P> = (props: P) => ReactElement<any, any> | null;
  type PropsWithChildren<P = unknown> = P & { children?: ReactNode | undefined };
  type ReactNode = ReactElement | string | number | ReactFragment | ReactPortal | boolean | null | undefined;
  interface ReactFragment {}
  interface ReactPortal extends ReactElement {}
  interface SVGProps<T> extends SVGAttributes<T> {}
  interface SVGAttributes<T> extends AriaAttributes, DOMAttributes<T> {}
  interface AriaAttributes {}
  interface DOMAttributes<T> {}
}
