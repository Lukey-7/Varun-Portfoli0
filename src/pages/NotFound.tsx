import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { DecodeText } from '@/sites/cyan/motion/DecodeText';
import { SignalScope } from '@/sites/cyan/lab/terminal/SignalScope';
import '@/sites/cyan/lab/terminal/not-found.css';

/** The lab's not-found page: a dead channel, and two ways back. */
const NotFound = () => {
  const { pathname } = useLocation();

  return (
    <section className="lab-section nf" aria-labelledby="nf-title">
      <div className="nf-grid">
        <div className="nf-copy">
          <p className="lab-eyebrow mono">
            <DecodeText text="Lab / 404 / Signal lost" duration={650} />
          </p>
          <h1 id="nf-title" className="nf-title">
            <span className="nf-code" data-text="404" aria-hidden="true">
              404
            </span>
            <span className="sr-only">404: </span>
            Signal lost. <span>Nothing is broadcasting here.</span>
          </h1>
          <p className="nf-shell mono">
            <span className="nf-prompt" aria-hidden="true">
              $
            </span>{' '}
            cat {pathname}
            <br />
            No such file or directory
          </p>
          <div className="nf-actions">
            <Link to="/" className="lab-button">
              Back to home <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/nexus" className="lab-button ghost">
              Open the archive
            </Link>
          </div>
        </div>
        <SignalScope pathname={pathname} />
      </div>
    </section>
  );
};

export default NotFound;
