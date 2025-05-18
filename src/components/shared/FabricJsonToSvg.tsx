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
  targetWidth = 800, // Default original width
  targetHeight = 400, // Default original height to match a 2:1 aspect ratio
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

        const jsonProvidedWidth = fabricJSON.canvas?.width || fabricJSON.width;
        const jsonProvidedHeight = fabricJSON.canvas?.height || fabricJSON.height;

        // Determine viewBox dimensions: use JSON if available, else defaults, ensuring aspect ratio for fallbacks
        let vbWidth = jsonProvidedWidth || targetWidth;
        let vbHeight = jsonProvidedHeight || (jsonProvidedWidth ? (jsonProvidedWidth * (targetHeight / targetWidth)) : targetHeight);
        // If jsonProvidedWidth was also null, vbWidth is targetWidth, so vbHeight becomes targetHeight (e.g. 800x400)
        if (!jsonProvidedWidth && !jsonProvidedHeight) {
            vbWidth = targetWidth;
            vbHeight = targetHeight;
        }

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

        const objects = tempCanvas.getObjects();
        if (objects.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          
          objects.forEach(obj => {
            // getBoundingRect() returns coords relative to canvas origin {left, top, width, height}
            // It considers the object's angle and scale.
            const rect = obj.getBoundingRect();
            minX = Math.min(minX, rect.left);
            minY = Math.min(minY, rect.top);
            maxX = Math.max(maxX, rect.left + rect.width);
            maxY = Math.max(maxY, rect.top + rect.height);
          });

          if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
            const padding = 10; // Reduced padding
            vbWidth = Math.ceil(maxX - minX) + (2 * padding);
            vbHeight = Math.ceil(maxY - minY) + (2 * padding);
          } else {
            // Fallback if bounding box calculation failed (e.g., no objects had valid rects)
            vbWidth = tempCanvas.width || targetWidth;
            vbHeight = tempCanvas.height || targetHeight;
          }
          
          if (vbWidth <= 0) vbWidth = targetWidth; // Final fallback for width
          if (vbHeight <= 0) vbHeight = targetHeight; // Final fallback for height
        } else {
          // No objects, use full canvas viewBox
          vbWidth = tempCanvas.width || targetWidth;
          vbHeight = tempCanvas.height || targetHeight;
        }

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
    return <div className={`${className || ''} fabric-svg-placeholder`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #ddd' }}><span style={{color:'#888', fontSize: '0.9rem', fontStyle: 'italic'}}>No drawing submitted</span></div>;
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