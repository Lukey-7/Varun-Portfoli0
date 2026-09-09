import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useFinePointer } from '@/hooks/use-fine-pointer';

const NebulaBackground = () => {
  const isFinePointer = useFinePointer();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Very slow, smooth following
  const springConfig = { damping: 100, stiffness: 20, mass: 2 };
  const nebulaX = useSpring(mouseX, springConfig);
  const nebulaY = useSpring(mouseY, springConfig);
  
  useEffect(() => {
    // Parallax only makes sense with a real pointer; skip the listener
    // entirely on touch devices rather than animating for nobody.
    if (!isFinePointer) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Offset from center, scaled down
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      mouseX.set((e.clientX - centerX) * 0.1);
      mouseY.set((e.clientY - centerY) * 0.1);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY, isFinePointer]);
  
  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, hsl(180 40% 3%) 0%, hsl(0 0% 1%) 70%)',
        }}
      />
      
      {/* Primary nebula blob */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full animate-nebula-drift"
        style={{
          x: nebulaX,
          y: nebulaY,
          left: '30%',
          top: '20%',
          background: 'radial-gradient(ellipse at center, hsl(180 100% 50% / 0.08) 0%, hsl(180 80% 30% / 0.03) 40%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      
      {/* Secondary nebula blob */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          x: nebulaX,
          y: nebulaY,
          right: '10%',
          bottom: '10%',
          background: 'radial-gradient(ellipse at center, hsl(190 80% 40% / 0.06) 0%, hsl(180 60% 20% / 0.02) 50%, transparent 70%)',
          filter: 'blur(60px)',
          animationDelay: '-7s',
        }}
        animate={{
          scale: [1, 1.1, 0.95, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Tertiary accent blob */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          left: '60%',
          top: '50%',
          background: 'radial-gradient(ellipse at center, hsl(170 90% 45% / 0.05) 0%, transparent 60%)',
          filter: 'blur(50px)',
        }}
        animate={{
          x: [0, 50, -30, 0],
          y: [0, -40, 30, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Subtle grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(180 100% 50% / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(180 100% 50% / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
        }}
      />
      
      {/* Vignette */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 0%, hsl(0 0% 1% / 0.5) 70%, hsl(0 0% 1%) 100%)',
        }}
      />
    </div>
  );
};

export default NebulaBackground;
