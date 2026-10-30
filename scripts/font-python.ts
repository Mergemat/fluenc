// The Python the font scripts run FontTools with. uv fetches the pinned packages on first use and
// caches them, so building fonts needs uv and nothing else set up.
export const python = [
  "uv",
  "run",
  "--quiet",
  "--no-project",
  "--with",
  "fonttools==4.65.0",
  "--with",
  "brotli",
  "python",
];
