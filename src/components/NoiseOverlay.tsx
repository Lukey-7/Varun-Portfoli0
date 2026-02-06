import { useEffect, useRef } from 'react';

const NoiseOverlay = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    let frame = 0;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    const generateNoise = () => {
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 255;
        data[i] = noise;     // R
        data[i + 1] = noise; // G
        data[i + 2] = noise; // B
        data[i + 3] = 8;     // Very subtle alpha
      }
      
      ctx.putImageData(imageData, 0, 0);
    };
    
    const animate = () => {
      frame++;
      // Update every 3 frames for performance
      if (frame % 3 === 0) {
        generateNoise();
      }
      animationId = requestAnimationFrame(animate);
    };
    
    resize();
    window.addEventListener('resize', resize);
    animate();
    
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9998] opacity-[0.04]"
      style={{ mixBlendMode: 'overlay' }}
    />
  );
};

export default NoiseOverlay;
