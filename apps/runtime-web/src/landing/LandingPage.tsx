import { useEffect, useRef, type MouseEventHandler, type ReactNode } from "react";
import { mountLandingMotion } from "./motion.js";
import "./landing.css";

export function LandingPage({ themeControl, onEntry, children }: {
  themeControl: ReactNode; onEntry: MouseEventHandler<HTMLAnchorElement>; children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Plenum | Governed simulation platform";
    const cleanup = root.current ? mountLandingMotion(root.current) : undefined;
    return () => { cleanup?.(); document.title = previousTitle; };
  }, []);
  return <div className="entry-v12" ref={root}>
  <a className="skip-link" href="#main-content">Skip to content</a>

  
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
    <defs>
      <symbol id="plenum-wordmark" viewBox="55 200 2025 358">
        <path d="M61 208H190C255 208 305 255 305 313C305 372 255 420 190 420H152V376H192C231 376 259 349 259 313C259 278 231 249 192 249H108V548H61Z"/>
        <path d="M390 208H437V502H610V548H390Z"/>
        <path d="M687 208H914V250H734V352H898V394H734V502H914V548H687Z"/>
        <path d="M1002 208H1047L1232 465V208H1280V548H1236L1050 290V548H1002Z"/>
        <path d="M1380 208H1427V430C1427 480 1460 507 1514 507C1568 507 1600 480 1600 430V208H1648V432C1648 505 1595 552 1514 552C1433 552 1380 505 1380 432Z"/>
        <path d="M1750 208H1797L1911 381L2025 208H2072V548H2025V290L1913 462H1909L1797 290V548H1750Z"/>
      </symbol>
      <symbol id="open-arc" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" pathLength="100" strokeDasharray="80 20" transform="rotate(171 12 12)"/>
      </symbol>
    </defs>
  </svg>

  <header className="site-header">
    <a className="brand" href="#top" aria-label="Plenum home">
      <svg className="wordmark" viewBox="0 0 2025 358" role="img" aria-label="Plenum"><use href="#plenum-wordmark" fill="currentColor"/></svg>
      <span className="brand__divider" aria-hidden="true"></span>
      <span className="brand__tagline">Governed simulation platform</span>
    </a>
    <nav className="site-nav" aria-label="Account">
      <a className="site-nav__link" href="/auth/login?returnTo=%2F" onClick={onEntry}>Sign in</a>
      {themeControl}
    </nav>
  </header>

  <main id="main-content" tabIndex={-1}>
    
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero__copy">
        <h1 className="hero__title" id="hero-title">
          <svg className="wordmark hero__wordmark" viewBox="0 0 2025 358" role="img" aria-label="Plenum"><use href="#plenum-wordmark" fill="currentColor"/></svg>
        </h1>
        <p className="hero__lede">Design and deliver simulations,<br className="hero__break" /> from first brief to after-action review.</p>
        <div className="hero__actions">
          <a className="button" href="/auth/login?returnTo=%2F" onClick={onEntry}>
            Enter Plenum
          </a>
        </div>
      </div>
      <a className="hero__cue" href="#room">
        Inside the room
        <svg className="arc" aria-hidden="true"><use href="#open-arc"/></svg>
      </a>
    </section>

    
    <div className="peek" aria-hidden="true"><div className="art"></div></div>

    
    <section className="room" id="room" aria-labelledby="room-title">
      <div className="room__sticky">
        <div className="room__copy">
          <h2 className="room__title" id="room-title">Built for designers, facilitators and analysts.</h2>
          <ol className="steps">
            <li className="step is-active" data-ring="design">
              <div className="art step__crop step__crop--design" aria-hidden="true"></div>
              <h3 className="step__title">Design the simulation.</h3>
              <p className="step__body">Set the scenario, teams, roles and stages, and decide what each side sees. Publish a locked version you can run again.</p>
            </li>
            <li className="step" data-ring="deliver">
              <div className="art step__crop step__crop--deliver" aria-hidden="true"></div>
              <h3 className="step__title">Deliver it live.</h3>
              <p className="step__body">In the room or online, participants play in teams and roles, each with its own decision forms. Facilitators run the clock, the injects and the rulings.</p>
            </li>
            <li className="step" data-ring="audit">
              <div className="art step__crop step__crop--audit" aria-hidden="true"></div>
              <h3 className="step__title">Review what happened.</h3>
              <p className="step__body">Every decision and ruling feeds an after-action record built for analysis. Plugins add models and analysis tools where you need them.</p>
            </li>
          </ol>
          <div className="room__meter" aria-hidden="true">
            <span className="room__meter-fill"></span>
            <span className="room__tick is-reached" style={{ left: "0%" }}></span>
            <span className="room__tick" style={{ left: "33.333%" }}></span>
            <span className="room__tick" style={{ left: "66.667%" }}></span>
          </div>
        </div>
        <div className="room__stage" data-ring="design">
          <div className="room__frame">
            <div className="art" role="img" aria-label="Pencil sketch of an open amphitheatre: tiered seating curves around a round table with eight chairs, open on one side."></div>
            <div className="fog fog--design" aria-hidden="true"></div>
            <div className="fog fog--deliver" aria-hidden="true"></div>
            <div className="fog fog--audit" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </section>

    <section className="closing" aria-labelledby="closing-title">
      <h2 className="closing__title" id="closing-title">Take your seat.</h2>
      <p className="closing__body">Sign in with your Organization account and pick up where your team left off.</p>
      <a className="button" href="/auth/login?returnTo=%2F" onClick={onEntry}>
        Enter Plenum
      </a>
    </section>
  </main>

  <footer className="site-footer">
    <svg className="wordmark" viewBox="0 0 2025 358" role="img" aria-label="Plenum"><use href="#plenum-wordmark" fill="currentColor"/></svg>
    <span>Governed simulation platform</span>
  </footer>


    <span className="visually-hidden" role="status" aria-live="polite" aria-label="Plenum status: Sign-in required">Sign-in required</span>
    {children}
  </div>;
}
