import { useCallback, useEffect, useLayoutEffect, useRef, type FocusEvent } from "react";
import { Link, NavLink } from "react-router-dom";

export interface NavItem {
  label: string;
  to: string;
}

/**
 * The header's page links over one shared hairline. The line rests under the
 * current page and glides to whichever link is pointed at or focused, then
 * returns. It is placed by measurement, so nothing runs between interactions.
 */
export function NavRail({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const nav = useRef<HTMLElement>(null);
  const rail = useRef<HTMLSpanElement>(null);
  const onWork = pathname.startsWith("/work/");

  const place = useCallback((target?: HTMLElement | null) => {
    const line = rail.current;
    const list = nav.current;
    if (!line || !list) return;
    const link = target ?? list.querySelector<HTMLElement>("a.active");
    if (!link) {
      line.dataset.shown = "false";
      return;
    }
    line.dataset.shown = "true";
    line.style.width = `${link.offsetWidth}px`;
    line.style.transform = `translateX(${link.offsetLeft}px)`;
  }, []);

  // After the active class moves, before paint, so the line never lags a page.
  useLayoutEffect(() => {
    place();
  }, [pathname, place]);

  useEffect(() => {
    const list = nav.current;
    const line = rail.current;
    if (!list || !line) return;
    const settle = () => place();
    // Fonts arriving change the link widths; only then may the line animate.
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      settle();
      line.dataset.ready = "true";
    });
    if (!document.fonts) line.dataset.ready = "true";
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", settle);
      return () => {
        alive = false;
        window.removeEventListener("resize", settle);
      };
    }
    const observer = new ResizeObserver(settle);
    observer.observe(list);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [place]);

  const follow = (event: { target: EventTarget }) => {
    const link = (event.target as HTMLElement).closest?.("a");
    if (link) place(link);
  };
  const leaveFocus = (event: FocusEvent<HTMLElement>) => {
    if (!nav.current?.contains(event.relatedTarget as Node | null)) place();
  };

  return (
    <nav
      ref={nav}
      className="desktop-links nav-rail"
      aria-label="Main navigation"
      onPointerOver={follow}
      onPointerLeave={() => place()}
      onFocus={follow}
      onBlur={leaveFocus}
    >
      {items.map((item) =>
        item.to.startsWith("/#") ? (
          <Link
            key={item.label}
            to={item.to}
            className={onWork ? "active" : undefined}
            aria-current={onWork ? "page" : undefined}
          >
            {item.label}
          </Link>
        ) : (
          <NavLink key={item.label} to={item.to}>
            {item.label}
          </NavLink>
        ),
      )}
      <span ref={rail} className="nav-rail-line" aria-hidden="true" data-shown="false" />
    </nav>
  );
}
