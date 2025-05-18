import React, { useState, useEffect } from 'react';
import { fabric } from 'fabric';

interface FabricJsonToSvgProps {
  jsonData: string | undefined | null;
  // Target dimensions for the temporary canvas used to generate the SVG
  // These also guide the viewBox of the generated SVG.
  targetWidth?: number;
  targetHeight?: number;
  // Optional class for the wrapper div
  className?: string;
}

const FabricJsonToSvg: React.FC<FabricJsonToSvgProps> = ({ 
  jsonData,
  targetWidth = 800, // Default original width if not found in JSON
  targetHeight = 600, // Default original height if not found in JSON
  className 
}) => {
  const [svgString, setSvgString] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true); // Added loading state

  useEffect(() => {
    let tempCanvas: fabric.Canvas | null = null;
    let isMounted = true; // To prevent state updates on unmounted component
    setLoading(true); // Set loading true when effect runs

    const generateSvg = async () => {
      if (!jsonData) {
        if (isMounted) {
          setSvgString('');
          setLoading(false); // Done loading if no data
        }
        return;
      }

      try {
        const fabricJSON = JSON.parse(jsonData);

        const vbWidth = fabricJSON.canvas?.width || fabricJSON.width || targetWidth;
        const vbHeight = fabricJSON.canvas?.height || fabricJSON.height || targetHeight;

        const tempCanvasEl = document.createElement('canvas');
        tempCanvas = new fabric.Canvas(tempCanvasEl, {
          width: vbWidth,
          height: vbHeight,
          backgroundColor: 'transparent',
        });

        await new Promise<void>((resolve, reject) => {
          if (!tempCanvas) {
            if (isMounted) setLoading(false);
            reject(new Error("Temp canvas not init for JSON load."));
            return;
          }
          tempCanvas.loadFromJSON(fabricJSON, () => {
            if (!isMounted || !tempCanvas) {
              if (tempCanvas) tempCanvas.dispose(); // Clean up if unmounted during async
              if (isMounted) setLoading(false);
              reject(new Error("Component unmounted or canvas disposed during JSON load."));
              return;
            }
            tempCanvas.renderAll();
            tempCanvas.forEachObject(obj => {
              obj.selectable = false;
              obj.evented = false;
            });

            const svg = tempCanvas.toSVG({
              viewBox: { x: 0, y: 0, width: vbWidth, height: vbHeight }
            });
            if (isMounted) {
              setSvgString(svg);
              setLoading(false); // Done loading
            }
            resolve();
          });
        });

      } catch (error) {
        console.error('[FabricJsonToSvg] Error generating SVG:', error);
        if (isMounted) {
          setSvgString('<svg viewBox="0 0 100 75' + /* Fix for missing closing quote */ '><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ff5555">Error</text></svg>');
          setLoading(false); // Done loading (with error)
        }
      }
    };

    // generateSvg can't be directly async in useEffect if it relies on isMounted for state updates after await.
    // So, we call it and handle its promise if needed, or ensure state updates are safe.
    generateSvg().catch(err => {
        // This catch is for unhandled promise rejections from generateSvg itself, though try/catch inside should handle most.
        if (isMounted) {
            console.error("[FabricJsonToSvg] Async error in generateSvg execution:", err);
            setSvgString('<svg viewBox="0 0 100 75' + '><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ff0000">Exec Error</text></svg>');
            setLoading(false);
        }
    });

    return () => {
      isMounted = false;
      if (tempCanvas) {
        tempCanvas.dispose();
        tempCanvas = null;
      }
    };
  }, [jsonData, targetWidth, targetHeight]);

  if (loading) {
    return <div className={`${className || ''} fabric-svg-loading`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{color:'#777'}}>Loading...</span></div>;
  }

  if (!svgString) {
    // Render a placeholder or nothing if SVG is not ready or jsonData is null
    return <div className={`${className || ''} fabric-svg-placeholder`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{color:'#ccc'}}>No Drawing</span></div>;
  }

  // The parent container of this component should handle the final display size and aspect ratio.
  // This component just provides the raw, scalable SVG string.
  return (
    <div 
      className={`${className || ''} fabric-svg-rendered`}
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
};

export default FabricJsonToSvg; 