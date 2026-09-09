import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useFinePointer } from '@/hooks/use-fine-pointer';

const CustomCursor = () => {
  const isFinePointer = useFinePointer();
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);
  
  const velocityX = useMotionValue(0);
  const velocityY = useMotionValue(0);
  
  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    let lastTime = Date.now();
    
    const handleMouseMove = (e: MouseEvent) => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastTime;
      
      if (deltaTime > 0) {
        const vx = (e.clientX - lastX) / deltaTime;
        const vy = (e.clientY - lastY) / deltaTime;
        velocityX.set(Math.abs(vx));
        velocityY.set(Math.abs(vy));
      }
      
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = currentTime;
    };
    
    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);
    
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = 
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        !!target.closest('button') ||
        !!target.closest('a') ||
        target.classList.contains('cursor-pointer') ||
        !!target.closest('.cursor-pointer');
      
      setIsHovering(!!isInteractive);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseover', handleMouseOver);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [mouseX, mouseY, velocityX, velocityY]);

  // Touch devices keep their native tap targets and no floating ring.
  if (!isFinePointer) return null;

  return (
    <>
      {/* Main cursor ring */}
      <motion.div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[10000] mix-blend-difference"
        style={{
          x: cursorX,
          y: cursorY,
        }}
      >
        <motion.div
          className="relative -translate-x-1/2 -translate-y-1/2"
          animate={{
            scale: isClicking ? 0.8 : isHovering ? 1.5 : 1,
            opacity: isHovering ? 1 : 0.8,
          }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {/* Outer ring */}
          <motion.div
            className="w-10 h-10 rounded-full border-2 border-primary"
            style={{
              boxShadow: isHovering 
                ? '0 0 20px hsl(var(--primary) / 0.6), inset 0 0 20px hsl(var(--primary) / 0.2)' 
                : '0 0 10px hsl(var(--primary) / 0.3)',
            }}
            animate={{
              borderWidth: isHovering ? 3 : 2,
            }}
          />
          
          {/* Inner dot */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
            animate={{
              scale: isHovering ? 0 : 1,
              opacity: isHovering ? 0 : 1,
            }}
            transition={{ duration: 0.1 }}
          />
        </motion.div>
      </motion.div>
      
      {/* Trail effect */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          x: cursorX,
          y: cursorY,
        }}
      >
        <motion.div
          className="relative -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.1) 0%, transparent 70%)',
          }}
          animate={{
            scale: isHovering ? 1.5 : 1,
          }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </>
  );
};

export default CustomCursor;
