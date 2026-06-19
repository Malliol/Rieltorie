import type { Theme } from "../../../schema/types.js";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function shell(opts: {
  title: string;
  body: string;
  theme: Theme;
  base?: string;
}): string {
  const { title, body, theme: t, base = "" } = opts;
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: ${t.bg};
      color: ${t.ink};
      font-family: ${t.body};
      -webkit-font-smoothing: antialiased;
      --accent: ${t.accent};
      --ink: ${t.ink};
      --border: ${t.border};
    }
    :focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
    img[style*="visibility:hidden"] { display: none; }
  </style>
  <script>
    document.addEventListener('error', function(e) {
      if (e.target && e.target.tagName === 'IMG') {
        e.target.style.visibility = 'hidden';
      }
    }, true);
  </script>
</head>
<body>
${body}
</body>
</html>`;
}
