import React, { useState, useEffect } from 'react';
import { fabric } from 'fabric';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../i18n';

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
  const { language } = useLanguage();
  const [svgString, setSvgString] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true); // Added loading state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let tempCanvas: fabric.Canvas | null = null;
    let isMounted = true; // To prevent state updates on unmounted component
    setLoading(true); // Set loading true when effect runs
    setErrorMessage(null); // Reset error state

    const generateSvg = async () => {
      if (!jsonData) {
        console.log('[FabricJsonToSvg] No json data provided');
        if (isMounted) {
          setSvgString('');
          setLoading(false); // Done loading if no data
        }
        return;
      }

      // Debug: Log the first part of jsonData to help diagnose format issues
      console.log('[FabricJsonToSvg] Processing jsonData:', jsonData.substring(0, 100) + '...');

      try {
        const fabricJSON = JSON.parse(jsonData);
        console.log('[FabricJsonToSvg] Successfully parsed JSON, checking for objects...');

        // Check if there are any objects in the JSON
        const hasObjects = fabricJSON.objects && Array.isArray(fabricJSON.objects) && fabricJSON.objects.length > 0;
        console.log('[FabricJsonToSvg] Contains objects:', hasObjects, 'Object count:', fabricJSON.objects?.length || 0);

        const jsonProvidedWidth = fabricJSON.canvas?.width || fabricJSON.width;
        const jsonProvidedHeight = fabricJSON.canvas?.height || fabricJSON.height;

        console.log('[FabricJsonToSvg] Canvas dimensions from JSON:', { 
          width: jsonProvidedWidth || 'not specified', 
          height: jsonProvidedHeight || 'not specified' 
        });

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
            if (isMounted) {
              setLoading(false);
              setErrorMessage(t('failedToInitializeCanvas', language));
            }
            reject(new Error("Temp canvas not init for JSON load."));
            return;
          }
          
          try {
            tempCanvas.loadFromJSON(fabricJSON, () => {
              if (!isMounted || !tempCanvas) {
                if (tempCanvas) tempCanvas.dispose(); // Clean up if unmounted during async
                if (isMounted) setLoading(false);
                reject(new Error("Component unmounted or canvas disposed during JSON load."));
                return;
              }

              // Check if any objects were loaded
              const objectCount = tempCanvas.getObjects().length;
              console.log('[FabricJsonToSvg] Objects loaded to canvas:', objectCount);
              
              // Make paths non-selectable and prepare them for display
              tempCanvas.forEachObject(obj => {
                obj.selectable = false;
                obj.evented = false;
                
                if (obj.type === 'path') {
                  const pathColor = (obj as any).stroke || (obj as any).fill;
                  
                  // Skip eraser stroke processing completely
                  // Only enhance light-colored strokes for visibility
                  if (pathColor && isLightColor(pathColor)) {
                    try {
                      // Slightly increase stroke width for better visibility of light colors
                      (obj as any).strokeWidth = Math.max(1.2, (obj as any).strokeWidth || 0);
                      
                      // If it's pure white, make it slightly off-white for better visibility
                      // This helps with the contrast on the chalkboard background
                      if ((obj as any).stroke === '#FFFFFF' || (obj as any).stroke === '#ffffff' || (obj as any).stroke === 'white') {
                        (obj as any).stroke = '#F8F8F8';
                      }
                    } catch (enhanceError) {
                      console.warn('[FabricJsonToSvg] Could not enhance path visibility:', enhanceError);
                    }
                  }
                }
              });
              
              tempCanvas.renderAll();

              try {
                const svg = tempCanvas.toSVG({
                  viewBox: { x: 0, y: 0, width: vbWidth, height: vbHeight }
                });
                
                if (isMounted) {
                  if (svg && svg.includes('<svg')) {
                    console.log('[FabricJsonToSvg] Successfully generated SVG');
                    
                    // Add chalkboard class to SVG for consistent styling with CSS
                    const enhancedSvg = svg.replace('<svg ', '<svg class="chalkboard-drawing-svg" ');
                    setSvgString(enhancedSvg);
                  } else {
                    console.error('[FabricJsonToSvg] toSVG produced invalid output:', svg);
                    setErrorMessage(t('invalidSvg', language));
                    // Create a simple fallback SVG
                    setSvgString(`<svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="50%" text-anchor="middle" fill="#f00">${t('error', language)}: ${t('invalidSvg', language)}</text></svg>`);
                  }
                  setLoading(false); // Done loading
                }
                resolve();
              } catch (svgError: any) {
                console.error('[FabricJsonToSvg] Error generating SVG:', svgError);
                if (isMounted) {
                  setErrorMessage(t('svgGenerationFailed', language) + ': ' + svgError.message);
                  setLoading(false);
                }
                reject(svgError);
              }
            });
          } catch (loadError: any) {
            console.error('[FabricJsonToSvg] Error in loadFromJSON:', loadError);
            if (isMounted) {
              setErrorMessage(t('failedToLoadJson', language) + ': ' + loadError.message);
              setLoading(false);
            }
            reject(loadError);
          }
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

      } catch (error: any) {
        console.error('[FabricJsonToSvg] Error generating SVG:', error);
        if (isMounted) {
          setErrorMessage(error.message || t('failedToLoadJson', language));
          setSvgString(`<svg viewBox="0 0 100 75"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ff5555">${t('error', language)}</text></svg>`);
          setLoading(false); // Done loading (with error)
        }
      }
    };

    // Helper function to determine if a color is white or very light
    const isLightColor = (color: string): boolean => {
      // Handle named colors
      if (color === 'white' || color === '#fff' || color === '#ffffff' || color === 'rgb(255,255,255)') {
        return true;
      }
      
      // Try to handle hex colors
      if (color.startsWith('#')) {
        // Convert 3-digit hex to 6-digit
        const hex = color.length === 4 
          ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}` 
          : color;
          
        // Get RGB from hex
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        
        // Calculate perceived brightness
        // Uses the formula: (0.299*R + 0.587*G + 0.114*B)
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Return true if very bright (white or near white)
        return brightness > 0.85;
      }
      
      // Try to handle rgb/rgba colors
      if (color.startsWith('rgb')) {
        const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (rgbMatch) {
          const r = parseInt(rgbMatch[1], 10);
          const g = parseInt(rgbMatch[2], 10);
          const b = parseInt(rgbMatch[3], 10);
          
          // Calculate perceived brightness
          const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          
          // Return true if very bright
          return brightness > 0.85;
        }
      }
      
      // Default to false if we can't determine
      return false;
    };

    // generateSvg can't be directly async in useEffect if it relies on isMounted for state updates after await.
    // So, we call it and handle its promise if needed, or ensure state updates are safe.
    generateSvg().catch(err => {
        // This catch is for unhandled promise rejections from generateSvg itself, though try/catch inside should handle most.
        if (isMounted) {
            console.error("[FabricJsonToSvg] Async error in generateSvg execution:", err);
            setErrorMessage(`${t('unexpectedError', language)}: ${err.message}`);
            setSvgString('<svg viewBox="0 0 100 75"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ff0000">Exec Error</text></svg>');
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
  }, [jsonData, targetWidth, targetHeight, language]);

  if (loading) {
    return <div className={`${className || ''} fabric-svg-loading`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{color:'#777'}}>{t('loading', language)}...</span></div>;
  }

  if (errorMessage) {
    return (
      <div className={`${className || ''} fabric-svg-error`} style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        border: '1px dashed #ff5555',
        padding: '10px'
      }}>
        <span style={{color:'#ff5555', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px'}}>{t('error', language)}</span>
        <span style={{color:'#888', fontSize: '0.8rem', textAlign: 'center'}}>{errorMessage}</span>
      </div>
    );
  }

  if (!svgString) {
    // Render a placeholder or nothing if SVG is not ready or jsonData is null
    return <div className={`${className || ''} fabric-svg-placeholder`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #ddd' }}><span style={{color:'#888', fontSize: '0.9rem', fontStyle: 'italic'}}>{t('noDrawingSubmitted', language)}</span></div>;
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