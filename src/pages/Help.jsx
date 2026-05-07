// src/pages/Help.jsx
//
// Public help center. Search-first, category-organized, zero-cost.
// Index built at compile time from docs/HELP_ARTICLES/*.md via the
// scripts/build-help-articles.js prebuild step.
//
// Architecture decisions:
//   - FlexSearch for browser-side full-text search ($0 forever)
//   - Articles bundled into JS at build time (no runtime fetch)
//   - Reuses MarkdownView component from Founder Hub for consistent
//     rendering of markdown bodies
//   - URL hash carries the active article id so links work and
//     browser back/forward navigates between articles
//
// What this is NOT:
//   - An AI chat (deferred per CUSTOMER_CHAT_RESEARCH.md decision)
//   - A live-document fetch from GitHub (articles are static, bundled)
//
// Per HK direction: do not turn this on (link from public nav) until
// confirmed. Page is reachable via direct URL only for now.

import { useState, useEffect, useMemo, useRef } from "react";
import FlexSearch from "flexsearch";
import Nav from "../components/Nav";
import MarkdownView from "../components/founder/MarkdownView";
import HELP_ARTICLES from "../data/helpArticles";

const C = {
  forest: "#2A5741",
  sage:   "#9DAA85",
  ink:    "#1F3A2C",
  gray:   "#6B7280",
  cream:  "#FAF6EE",
  border: "#E5D5C8",
  green:  "#16A34A",
  paper:  "#FBFAF6",
};

// Preserve the order categories appear (defined order, not alphabetical).
// Reflects logical user journey: getting started first, payments last
// because they are reference material rather than first-encounter.
const CATEGORY_ORDER = [
  "Getting started",
  "Booking and scheduling",
  "Intake forms",
  "Sessions and notes",
  "Payments",
  "Practical",
];

function getCategoryOrder(cat) {
  const idx = CATEGORY_ORDER.indexOf(cat);
  return idx === -1 ? 999 : idx;
}

export default function Help() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(() => {
    // Read initial article from URL hash
    if (typeof window !== "undefined" && window.location.hash) {
      return window.location.hash.replace("#", "");
    }
    return HELP_ARTICLES[0]?.id;
  });
  const [activeCategory, setActiveCategory] = useState(null);
  const searchRef = useRef(null);

  // Build the FlexSearch index once on mount. Indexes title, keywords,
  // and body for each article. Returns article ids on search.
  const index = useMemo(() => {
    const idx = new FlexSearch.Document({
      tokenize: "forward",
      cache: 100,
      document: {
        id: "id",
        index: ["title", "keywords", "body"],
        store: ["title", "category"],
      },
    });
    HELP_ARTICLES.forEach((article) => {
      idx.add({
        id: article.id,
        title: article.title,
        keywords: article.keywords,
        body: article.body,
        category: article.category,
      });
    });
    return idx;
  }, []);

  // Filter articles based on search query + category filter
  const filteredArticles = useMemo(() => {
    let articles = HELP_ARTICLES;

    if (query.trim()) {
      // Search across all indexed fields, dedupe ids
      const results = index.search(query, { limit: 50 });
      const matchedIds = new Set();
      results.forEach((fieldResult) => {
        fieldResult.result.forEach((id) => matchedIds.add(id));
      });
      articles = HELP_ARTICLES.filter((a) => matchedIds.has(a.id));
    }

    if (activeCategory) {
      articles = articles.filter((a) => a.category === activeCategory);
    }

    return articles;
  }, [query, activeCategory, index]);

  // Group filtered articles by category for left rail rendering
  const articlesByCategory = useMemo(() => {
    const groups = {};
    filteredArticles.forEach((a) => {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    });
    // Sort categories and within-category by order
    const sortedGroups = {};
    Object.keys(groups)
      .sort((a, b) => getCategoryOrder(a) - getCategoryOrder(b))
      .forEach((cat) => {
        sortedGroups[cat] = groups[cat].sort((a, b) => a.order - b.order);
      });
    return sortedGroups;
  }, [filteredArticles]);

  // Active article object
  const activeArticle = useMemo(() => {
    return HELP_ARTICLES.find((a) => a.id === activeId) || HELP_ARTICLES[0];
  }, [activeId]);

  // Update URL hash when active changes (so links are shareable)
  useEffect(() => {
    if (activeId && typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${activeId}`);
    }
  }, [activeId]);

  // Listen for hash changes (browser back/forward)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) setActiveId(hash);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // Focus search on / shortcut (familiar from Stripe, Linear, etc.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <Nav />
      <div style={{
        minHeight: "100vh",
        background: C.paper,
        paddingTop: 80,
      }}>
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "32px 24px 80px",
        }}>
          <Header
            query={query}
            setQuery={setQuery}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            searchRef={searchRef}
            resultCount={filteredArticles.length}
          />

          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 300px) 1fr",
            gap: 24,
            alignItems: "start",
            marginTop: 28,
          }}>
            <ArticleList
              articlesByCategory={articlesByCategory}
              activeId={activeId}
              setActiveId={setActiveId}
              query={query}
            />
            <ArticleContent article={activeArticle} setActiveId={setActiveId} />
          </div>

          <FooterCTA />
        </div>
      </div>
    </>
  );
}

function Header({ query, setQuery, activeCategory, setActiveCategory, searchRef, resultCount }) {
  return (
    <div>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.sage,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        marginBottom: 6,
      }}>
        Help Center
      </div>
      <h1 style={{
        fontFamily: "Georgia, serif",
        fontSize: 32,
        fontWeight: 700,
        color: C.forest,
        margin: 0,
        marginBottom: 8,
      }}>
        How can we help?
      </h1>
      <p style={{
        fontSize: 14,
        color: C.gray,
        margin: 0,
        marginBottom: 18,
        maxWidth: 600,
        lineHeight: 1.6,
      }}>
        Search articles below, or email Joy directly if you cannot find what you need.
      </p>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search help articles..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "14px 18px 14px 46px",
            fontSize: 15,
            border: `1.5px solid ${C.border}`,
            borderRadius: 12,
            background: "#fff",
            color: C.ink,
            outline: "none",
            fontFamily: "system-ui",
            boxSizing: "border-box",
          }}
          onFocus={(e) => { e.target.style.borderColor = C.forest; }}
          onBlur={(e) => { e.target.style.borderColor = C.border; }}
        />
        <div style={{
          position: "absolute",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          color: C.gray,
          fontSize: 16,
          pointerEvents: "none",
        }}>
          🔍
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <CategoryPill
          label="All"
          active={!activeCategory}
          onClick={() => setActiveCategory(null)}
        />
        {CATEGORY_ORDER.map((cat) => (
          <CategoryPill
            key={cat}
            label={cat}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
          />
        ))}
        {(query || activeCategory) && (
          <span style={{
            fontSize: 12,
            color: C.gray,
            marginLeft: 8,
          }}>
            {resultCount} {resultCount === 1 ? "article" : "articles"}
          </span>
        )}
      </div>
    </div>
  );
}

function CategoryPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.forest : "transparent",
        color: active ? "#fff" : C.ink,
        border: `1.5px solid ${active ? C.forest : C.border}`,
        borderRadius: 99,
        padding: "7px 16px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function ArticleList({ articlesByCategory, activeId, setActiveId, query }) {
  const totalArticles = Object.values(articlesByCategory).reduce(
    (sum, list) => sum + list.length, 0
  );

  if (totalArticles === 0) {
    return (
      <div style={{
        background: "#fff",
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 24,
        position: "sticky",
        top: 96,
      }}>
        <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
          No articles match {query ? `"${query}"` : "this filter"}.
          <br /><br />
          Try a different search term, or email Joy directly:
          <br />
          <a
            href="mailto:hello@mybodymap.app?subject=Help%20question"
            style={{
              color: C.forest,
              fontWeight: 600,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            hello@mybodymap.app
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: 8,
      position: "sticky",
      top: 96,
      maxHeight: "calc(100vh - 120px)",
      overflowY: "auto",
      boxShadow: "0 4px 16px rgba(28, 43, 34, 0.05)",
    }}>
      {Object.entries(articlesByCategory).map(([category, articles]) => (
        <div key={category} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.gray,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            padding: "12px 12px 6px",
          }}>
            {category}
          </div>
          {articles.map((article, idx) => (
            <ArticleListItem
              key={article.id}
              article={article}
              active={activeId === article.id}
              onClick={() => setActiveId(article.id)}
              indexInCategory={idx + 1}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ArticleListItem({ article, active, onClick, indexInCategory }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: active ? C.cream : "transparent",
        border: "none",
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
        marginBottom: 1,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        color: active ? C.forest : C.ink,
        lineHeight: 1.45,
        transition: "background 0.12s",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <span style={{
        flexShrink: 0,
        fontFamily: "Georgia, serif",
        fontSize: 13,
        fontWeight: 700,
        color: active ? C.forest : C.gray,
        minWidth: 18,
      }}>
        {indexInCategory}.
      </span>
      <span>{article.title}</span>
    </button>
  );
}

function ArticleContent({ article, setActiveId }) {
  if (!article) return null;

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: "28px 32px",
      minHeight: 600,
      boxShadow: "0 4px 16px rgba(28, 43, 34, 0.05)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
        flexWrap: "wrap",
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.sage,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}>
          {article.category}
        </span>
        {article.taxonomy && /^\d/.test(article.taxonomy) && (
          <span title={`Maps to feature card ${article.taxonomy}`} style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.forest,
            background: C.cream,
            border: `1px solid ${C.border}`,
            padding: "2px 8px",
            borderRadius: 99,
            letterSpacing: 0.4,
          }}>
            Feature {article.taxonomy}
          </span>
        )}
      </div>
      <h2 style={{
        fontFamily: "Georgia, serif",
        fontSize: 32,
        fontWeight: 700,
        color: C.forest,
        margin: 0,
        marginBottom: 22,
        lineHeight: 1.2,
      }}>
        {article.title}
      </h2>

      <MarkdownView source={article.body} size="comfortable" />

      <ArticleFooter setActiveId={setActiveId} />
    </div>
  );
}

function ArticleFooter({ setActiveId }) {
  return (
    <div style={{
      marginTop: 36,
      paddingTop: 22,
      borderTop: `1px solid ${C.border}`,
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.6 }}>
        Did this answer your question? If not, email Joy directly. We respond within 24 hours.
      </div>
      <a
        href="mailto:hello@mybodymap.app?subject=Help%20question"
        style={{
          display: "inline-block",
          alignSelf: "flex-start",
          background: C.forest,
          color: "#fff",
          padding: "10px 18px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        ✉ Email Joy
      </a>
    </div>
  );
}

function FooterCTA() {
  return (
    <div style={{
      marginTop: 32,
      padding: "22px 28px",
      background: C.cream,
      border: `1px dashed ${C.border}`,
      borderRadius: 14,
      textAlign: "center",
    }}>
      <div style={{
        fontFamily: "Georgia, serif",
        fontSize: 18,
        color: C.forest,
        fontWeight: 700,
        marginBottom: 6,
      }}>
        Still need help?
      </div>
      <div style={{
        fontSize: 13,
        color: C.gray,
        marginBottom: 14,
        lineHeight: 1.6,
        maxWidth: 540,
        margin: "0 auto 14px",
      }}>
        If your question is not in the articles above, send Joy an email. She is the friendly face of MyBodyMap support and responds personally to every question within 24 hours.
      </div>
      <a
        href="mailto:hello@mybodymap.app?subject=Help%20question%20from%20mybodymap.app"
        style={{
          display: "inline-block",
          background: C.forest,
          color: "#fff",
          padding: "11px 22px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        ✉ Email Joy at hello@mybodymap.app
      </a>
    </div>
  );
}
