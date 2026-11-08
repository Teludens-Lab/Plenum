const SECTION_ICON_PATHS: Readonly<Record<string, string>> = {
  overview: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6",
  methodology: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z",
  teams: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.3a3.5 3.5 0 0 1 0 6.4M17.5 14.3c2 .8 3.5 3 3.5 5.7",
  roles: "M4 5h16v14H4zM9.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6.5 16c.5-1.7 1.6-2.5 3-2.5s2.5.8 3 2.5M15 10h3M15 14h3",
  seats: "M7 3v9h10V3M5 12h14v3H5zM7 15v6M17 15v6",
  activities: "M3 12h4l3-8 4 16 3-8h4",
  stages: "M3 20h6v-5h6v-5h6",
  forms: "M8 4h8v3H8zM8 5.5H5V21h14V5.5h-3M8 12h8M8 16h5",
  workflows: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v3a6 6 0 0 0 6 6h3",
  policies: "M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6zM9 12l2 2 4-4",
  communications: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  injects: "M13 3L5 14h6l-1 7 8-11h-6z",
  "content-library": "M4 4h5v16H4zM9 4h5v16H9zM15 5l4-1 3 15-4 1z",
  "advanced-logic": "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
  adjudication: "M12 4v16M7 20h10M5 7h14M5 7l-3 7h6zM19 7l-3 7h6z",
  polls: "M5 20v-7M12 20V4M19 20V9",
  voice: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  plugins: "M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4",
  compositions: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  interfaces: "M4 4h16v16H4zM4 9h16M10 9v11",
  research: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  "measurements-reports": "M4 4v16h16M8 16v-4M12 16V8M16 16v-6",
  access: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  preview: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  "test-validate": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12l3 3 5-6",
  "review-publish": "M12 16V4M7 9l5-5 5 5M4 20h16",
  "live-changes": "M12 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM7.5 16a7 7 0 0 1 0-9M16.5 7a7 7 0 0 1 0 9M4.5 19a11 11 0 0 1 0-15M19.5 4a11 11 0 0 1 0 15"
};

/** Decorative line icon for an editor section; renders nothing for an id without one. */
export function SectionIcon({ id }: { id: string }) {
  const path = SECTION_ICON_PATHS[id];
  if (path === undefined) return null;
  return <svg className="section-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={path} /></svg>;
}
