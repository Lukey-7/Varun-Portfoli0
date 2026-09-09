import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const navItems = [
  { path: '/', label: 'HOME', command: '~/' },
  { path: '/logs', label: 'LOGS', command: './experience' },
  { path: '/nexus', label: 'NEXUS', command: './projects' },
  { path: '/vault', label: 'VAULT', command: './skills' },
  { path: '/terminal', label: 'TERMINAL', command: './contact' },
];

const Navigation = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close the sheet whenever the route changes (including browser back).
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Don't let the page scroll behind the open sheet.
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 hidden md:block">
        <div className="mx-auto max-w-7xl px-8 py-6">
          <div className="glass rounded-2xl px-6 lg:px-8 py-4 flex items-center justify-between gap-6">
            {/* Logo */}
            <Link to="/" className="cursor-pointer shrink-0">
              <motion.div
                className="flex items-center gap-3"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-8 h-8 rounded-lg border border-primary/50 flex items-center justify-center">
                  <span className="text-primary text-glow font-bold text-sm">V</span>
                </div>
                <span className="text-foreground font-medium tracking-wider text-sm">
                  VARUN.DEV
                </span>
              </motion.div>
            </Link>

            {/* Nav Links */}
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} className="cursor-pointer">
                    <motion.div
                      className={`relative px-3 lg:px-4 py-2 rounded-lg transition-colors duration-300 ${
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-xs font-medium tracking-widest">
                        {item.label}
                      </span>

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
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
              <span className="text-xs text-muted-foreground tracking-wide">
                OPEN TO WORK
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 md:hidden">
        <div
          className="px-4 py-3"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg border border-primary/50 flex items-center justify-center">
                <span className="text-primary text-glow font-bold text-sm">V</span>
              </div>
              <span className="text-foreground font-medium tracking-wider text-xs">
                VARUN.DEV
              </span>
            </Link>

            <button
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className="-mr-2 p-2 text-foreground"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 -z-10 bg-background/70 backdrop-blur-md"
              />

              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="px-4 pb-4"
              >
                <div className="glass-intense rounded-xl p-3 space-y-1">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link key={item.path} to={item.path}>
                        <div
                          className={`px-4 py-4 rounded-lg flex items-center justify-between ${
                            isActive
                              ? 'bg-primary/10 border border-primary/30 text-primary'
                              : 'text-muted-foreground active:bg-muted/40'
                          }`}
                        >
                          <span className="text-sm font-medium tracking-widest">
                            {item.label}
                          </span>
                          <span className="text-xs opacity-50">{item.command}</span>
                        </div>
                      </Link>
                    );
                  })}

                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs text-muted-foreground tracking-wide">
                      OPEN TO WORK
                    </span>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
};

export default Navigation;
