import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      '404 Error: User attempted to access non-existent route:',
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <PageTransition>
      <div className="page-shell flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-intense rounded-2xl p-6 sm:p-10 max-w-lg w-full text-center"
        >
          <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-6">
            <div className="w-2 h-2 rounded-full bg-status-error animate-pulse" />
            <span className="text-[10px] sm:text-xs text-muted-foreground tracking-widest">
              SIGNAL LOST
            </span>
          </div>

          <h1 className="text-6xl sm:text-7xl font-bold tracking-tighter mb-3">
            <span className="gradient-text text-glow-intense">404</span>
          </h1>

          <p className="text-base sm:text-lg text-foreground mb-2">
            This route does not exist.
          </p>

          <p className="text-sm text-muted-foreground mb-8 font-mono break-all">
            <span className="text-primary">$</span> cat {location.pathname}
            <br />
            No such file or directory
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="px-6 py-3 rounded-xl bg-primary/15 border border-primary/50 text-primary text-sm font-medium tracking-wider transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              RETURN HOME
            </Link>
            <Link
              to="/nexus"
              className="px-6 py-3 rounded-xl glass text-foreground text-sm font-medium tracking-wider transition-colors hover:text-primary"
            >
              VIEW PROJECTS
            </Link>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default NotFound;
