// src/components/founder/useGithubMarkdown.js
//
// Hook that fetches a markdown file from the bodymap GitHub repo
// and returns { content, loading, error }. Used by every Founder
// Hub section that renders a live document.
//
// Why fetch from GitHub raw rather than bundling into the build:
// the founder docs are LIVE documents per HK direction. Updating
// them at the end of each working session and pushing to main
// means the next page load picks up the new content without a
// site rebuild. Bundling would require a fresh deploy for every
// edit.
//
// The tradeoff: a small delay on first load (~200-400ms typical)
// while we hit raw.githubusercontent.com. Cached aggressively
// after that.

import { useState, useEffect } from "react";

const REPO_RAW_BASE = "https://raw.githubusercontent.com/bodymapapp/bodymap/main/";

export default function useGithubMarkdown(path) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(REPO_RAW_BASE + path)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [path]);

  return { content, loading, error };
}
