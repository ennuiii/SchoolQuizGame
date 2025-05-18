import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PlayerBoard } from '../../types/game';
import { fabric } from 'fabric';

interface PlayerBoardDisplayProps {
  board: PlayerBoard;
  isVisible: boolean;
  transform?: { scale: number; x: number; y: number };
  onToggleVisibility: (playerId: string) => void;
  onScale: (playerId: string, scale: number) => void;
  onPan: (playerId: string, dx: number, dy: number) => void;
  onReset: (playerId: string) => void;
  width?: number;
  height?: number;
  onClick?: () => void;
  customClass?: string;
  fullscreen?: boolean;
  isInteractive?: boolean;
}

const PlayerBoardDisplay: React.FC<PlayerBoardDisplayProps> = ({
  board,
  isVisible,
  transform,
  onToggleVisibility,
  onScale,
  onPan,
  onReset,
  width = 300, // Default width for GM view
  height = 150, // Default height for GM view
  onClick,
  customClass,
  fullscreen,
  isInteractive = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef<boolean>(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scale, setScale] = useState(transform?.scale || 1);
  const [position, setPosition] = useState({ x: transform?.x || 0, y: transform?.y || 0 });
  const [svgString, setSvgString] = useState<string>('');

  // Effect to update internal state when transform prop changes
  useEffect(() => {
    if (transform) {
      setScale(transform.scale);
      setPosition({ x: transform.x, y: transform.y });
    }
  }, [transform]);

  // Effect to generate SVG from Fabric JSON data
  useEffect(() => {
    let tempCanvas: fabric.Canvas | null = null;
    
    const generateSvg = async () => {
      if (board.boardData && typeof board.boardData === 'string') {
        try {
          const fabricJSON = JSON.parse(board.boardData);
          
          // Determine the original dimensions for the viewBox and temp canvas
          // Prioritize dimensions from the JSON, then use more standard defaults for aspect ratio.
          const jsonWidth = fabricJSON.canvas?.width || fabricJSON.width;
          const jsonHeight = fabricJSON.canvas?.height || fabricJSON.height;

          const viewBoxWidth = jsonWidth || 800; // Default to a common canvas width if not in JSON
          const viewBoxHeight = jsonHeight || 600; // Default to a common canvas height if not in JSON

          const tempCanvasEl = document.createElement('canvas');
          tempCanvas = new fabric.Canvas(tempCanvasEl, {
            width: viewBoxWidth, // Use these for the temporary canvas rendering the SVG
            height: viewBoxHeight,
            backgroundColor: 'transparent',
          });

          await new Promise<void>((resolve, reject) => {
            if (!tempCanvas) {
              reject(new Error("Temporary canvas not initialized during loadFromJSON."));
              return;
            }
            tempCanvas.loadFromJSON(fabricJSON, () => {
              if (!tempCanvas) {
                reject(new Error("Temporary canvas disposed before loadFromJSON callback finished."));
                return;
              }
              tempCanvas.renderAll(); // Important to render before calculations
              tempCanvas.forEachObject(obj => {
                obj.selectable = false;
                obj.evented = false;
              });

              let vbX = 0;
              let vbY = 0;
              let vbWidth = viewBoxWidth;  // Fallback to original/default canvas width
              let vbHeight = viewBoxHeight; // Fallback to original/default canvas height

              const objects = tempCanvas.getObjects();
              if (objects.length > 0) {
                // Create a temporary group of all objects to get their combined bounding box
                // Need to ensure fabric.Group is available and correctly typed
                // This might require casting or checking if `fabric.Group` is defined.
                const group = new (fabric as any).Group(objects, {
                  canvas: tempCanvas // Associate with canvas for calculations
                });
                // group.destroy() is not needed if we don't add it to canvas

                // Get dimensions of the group
                // These are relative to the group's own origin, which is typically its center.
                // We need absolute top-left and bottom-right coordinates relative to canvas.
                // A simpler approach: use the group's width/height and its top/left AFTER it's calculated its own size.
                // However, group.left and group.top would be 0,0 if not added to canvas and positioned.
                // Instead, we can use a more direct approach to find extents:
                
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                objects.forEach(obj => {
                  const objLeft = obj.left || 0;
                  const objTop = obj.top || 0;
                  // Calculate scaled width/height, accounting for potential undefined scaleX/scaleY
                  const scaleX = obj.scaleX === undefined ? 1 : obj.scaleX;
                  const scaleY = obj.scaleY === undefined ? 1 : obj.scaleY;
                  const objWidth = (obj.width || 0) * scaleX;
                  const objHeight = (obj.height || 0) * scaleY;

                  // Consider object angle for a more accurate bounding box - this is complex.
                  // For a simpler approach, we use axis-aligned bounding box.
                  // If objects are rotated, this bounding box will be larger than the true visual extent.
                  // A more accurate method involves transforming corner coordinates.
                  // For now, this simpler method might be sufficient if rotations are not extreme.

                  minX = Math.min(minX, objLeft);
                  minY = Math.min(minY, objTop);
                  maxX = Math.max(maxX, objLeft + objWidth);
                  maxY = Math.max(maxY, objTop + objHeight);
                });

                if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
                  const padding = 20; // Increased padding
                  vbX = Math.floor(minX) - padding;
                  vbY = Math.floor(minY) - padding;
                  vbWidth = Math.ceil(maxX - minX) + (2 * padding);
                  vbHeight = Math.ceil(maxY - minY) + (2 * padding);
                }
                
                if (vbWidth <= 0) vbWidth = viewBoxWidth; // Fallback
                if (vbHeight <= 0) vbHeight = viewBoxHeight; // Fallback
              }

              const svg = tempCanvas.toSVG({
                viewBox: { x: vbX, y: vbY, width: vbWidth, height: vbHeight }
              });
              setSvgString(svg);
              resolve();
            });
          }).catch(error => {
              console.error('[PlayerBoardDisplay] Error in Fabric loadFromJSON/toSVG promise:', error);
              setSvgString('<svg viewBox="0 0 100 75"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ff5555">SVG Error</text></svg>');
          });

        } catch (error) {
          console.error('[PlayerBoardDisplay] Error parsing boardData JSON or generating SVG:', error);
          setSvgString('<svg viewBox="0 0 100 75"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ff5555">Parse Error</text></svg>');
        }
      } else {
        setSvgString('');
      }
    };

    generateSvg();

    return () => {
      if (tempCanvas) {
        tempCanvas.dispose();
        tempCanvas = null;
      }
    };
  }, [board.boardData, width, height]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(0.1, Math.min(10, scale + delta));
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const newX = position.x - ((mouseX - position.x) * (newScale / scale - 1));
    const newY = position.y - ((mouseY - position.y) * (newScale / scale - 1));
    setScale(newScale);
    setPosition({ x: newX, y: newY });
    onScale(board.playerId, newScale);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isInteractive || !e.altKey || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    isPanning.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    const newPositionX = position.x + dx;
    const newPositionY = position.y + dy;
    setPosition({ x: newPositionX, y: newPositionY });
    onPan(board.playerId, dx, dy);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'grab';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  // Handle toggle visibility - directly call the provided function
  const handleToggleVisibility = () => {
    onToggleVisibility(board.playerId);
  };

  return (
    <div className={`player-board-display-wrapper ${customClass || ''} ${fullscreen ? 'fullscreen-wrapper' : ''}`}>
      <div className="player-board-header d-flex justify-content-between align-items-center pb-1 pt-1">
        <div className="player-name">{board.playerName}</div>
        <div className="board-controls d-flex align-items-center">
          <div className="visibility-control ms-2">
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={handleToggleVisibility}
            >
              {isVisible ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Conditionally render the drawing board container based on isVisible */}
      {isVisible && (
        <div className={`drawing-board-container ${fullscreen ? 'fullscreen-drawing-area' : ''}`}>
          <div 
            ref={containerRef} 
            className="board-render-area"
            style={{ 
              width: '100%',
              height: '100%',
              cursor: isInteractive && isPanning.current ? 'grabbing' : (isInteractive ? 'grab' : 'default'),
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative' 
            }}
            onWheel={isInteractive ? handleWheel : undefined}
            onMouseDown={isInteractive ? handleMouseDown : undefined}
            onClick={onClick}
          >
            <div 
              className="svg-display-wrapper" 
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'center center', 
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              dangerouslySetInnerHTML={{ __html: svgString }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerBoardDisplay;