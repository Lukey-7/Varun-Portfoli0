import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const navItems = [
  { path: '/', label: 'HOME', command: '~/' },
  { path: '/nexus', label: 'NEXUS', command: './projects' },
  { path: '/vault', label: 'VAULT', command: './skills' },
  { path: '/terminal', label: 'TERMINAL', command: './contact' },
];

const Navigation = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <>
      {/* Desktop Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 hidden md:block">
        <div className="mx-auto max-w-7xl px-8 py-6">
          <div className="glass rounded-2xl px-8 py-4 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="cursor-pointer">
              <motion.div 
                className="flex items-center gap-3"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-8 h-8 rounded-lg border border-primary/50 flex items-center justify-center">
                  <span className="text-primary text-glow font-bold text-sm">V</span>
                </div>
                <span className="text-foreground font-medium tracking-wider text-sm">VARUN.DEV</span>
              </motion.div>
            </Link>
            
            {/* Nav Links */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link 
                    key={item.path} 
                    to={item.path}
                    className="cursor-pointer"
                  >
                    <motion.div
                      className={`relative px-4 py-2 rounded-lg transition-colors duration-300 ${
                        isActive 
                          ? 'text-primary' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-xs font-medium tracking-widest">{item.label}</span>
                      
                      {isActive && (
                        <motion.div
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-lg bg-primary/10 border border-primary/30"
                          style={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.2)' }}
                          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        />
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </div>
            
            {/* Status indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                <span className="text-xs text-muted-foreground tracking-wide">ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Mobile Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 md:hidden">
        <div className="px-4 py-4">
          <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
            <Link to="/" className="cursor-pointer">
              <div className="w-8 h-8 rounded-lg border border-primary/50 flex items-center justify-center">
                <span className="text-primary text-glow font-bold text-sm">V</span>
              </div>
            </Link>
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="cursor-pointer p-2 text-foreground"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="px-4 pb-4"
            >
              <div className="glass rounded-xl p-4 space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className="cursor-pointer"
                    >
                      <div
                        className={`px-4 py-3 rounded-lg flex items-center justify-between ${
                          isActive 
                            ? 'bg-primary/10 border border-primary/30 text-primary' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="text-sm font-medium tracking-widest">{item.label}</span>
                        <span className="text-xs opacity-50">{item.command}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
};

export default Navigation;
