export function createLogo(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fill background
  ctx.fillStyle = '#0C6A35';
  ctx.fillRect(0, 0, 512, 512);

  // Draw text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 120px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Q', 256, 256);

  return canvas.toDataURL('image/png');
} 