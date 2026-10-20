"use client";

import { useMemo, useState } from "react";
import styles from "./email-html-viewer.module.css";

type EmailHtmlViewerProps = {
  html: string;
  plainTextBody: string;
};

const REMOTE_ASSET_REFERENCE =
  /<(?:img|image)\b[^>]*\b(?:src|srcset)\s*=\s*(?:"|')?\s*(?:https?:)?\/\//i;

function sanitizeAnchorTags(markup: string): string {
  return markup.replace(/<a\b([^>]*)>/gi, (_opening, rawAttributes: string) => {
    const hrefMatch = rawAttributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+))/i);
    const candidate = (hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "").trim();
    const safeHref =
      /^(?:https?:\/\/|mailto:|tel:|#)/i.test(candidate) &&
      !/[\u0000-\u0020\u007f]/.test(candidate)
        ? candidate
        : "";

    const attributes = rawAttributes.replace(
      /\s+(?:href|target|rel|ping|download)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      "",
    );
    const fragmentOnly = safeHref.startsWith("#");
    return (
      "<a" +
      attributes +
      (safeHref ? ' href="' + safeHref + '"' : "") +
      (fragmentOnly ? "" : ' target="_blank" rel="noopener noreferrer"') +
      ">"
    );
  });
}

function sanitizeEmailMarkup(markup: string): string {
  return sanitizeAnchorTags(
    markup
      .replace(
        /<(script|iframe|frame|frameset|object|embed|applet|portal|form|video|audio|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
        "",
      )
      .replace(
        /<\/?(?:script|iframe|frame|frameset|object|embed|applet|portal|form|input|button|textarea|select|option|video|audio|source|track|link|meta|base|noscript)\b[^>]*\/?>/gi,
        "",
      )
      .replace(
        /\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
        "",
      )
      .replace(
        /\s+(?:srcdoc|formaction|action|ping|manifest)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
        "",
      )
      .replace(
        /\s+(?:href|xlink:href)\s*=\s*(?:"\s*(?:javascript|vbscript|data|file):[^"]*"|'\s*(?:javascript|vbscript|data|file):[^']*'|\s*(?:javascript|vbscript|data|file):[^\s>]+)/gi,
        "",
      )
      .replace(
        /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi,
        (_match, attributes: string, css: string) =>
          "<style" +
          attributes +
          ">" +
          css.replace(/@import\b[^;]*;?/gi, "").replace(/expression\s*\([^)]*\)/gi, "") +
          "</style>",
      ),
  );
}

function hasRemoteAssets(markup: string): boolean {
  return (
    REMOTE_ASSET_REFERENCE.test(markup) ||
    /\bbackground\s*=\s*(?:"|')?\s*(?:https?:)?\/\//i.test(markup) ||
    /url\(\s*["']?(?:https?:)?\/\//i.test(markup)
  );
}

function buildSandboxDocument(markup: string, loadRemoteImages: boolean): string {
  const imageSources = loadRemoteImages ? "data: cid: http: https:" : "data: cid:";
  const contentSecurityPolicy =
    "default-src 'none'; " +
    "script-src 'none'; " +
    "style-src 'unsafe-inline'; " +
    "img-src " + imageSources + "; " +
    "font-src data:; " +
    "connect-src 'none'; " +
    "frame-src 'none'; " +
    "object-src 'none'; " +
    "base-uri 'none'; " +
    "form-action 'none'; " +
    "media-src data:;";

  const readerStyles =
    "html,body{width:100%;min-height:100%;margin:0;padding:0;}" +
    "body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;overflow-wrap:anywhere;}" +
    "img{max-width:100%;height:auto;}" +
    "table{max-width:100%;}" +
    "pre{white-space:pre-wrap;overflow-wrap:anywhere;}" +
    "td,th{overflow-wrap:anywhere;}";

  return (
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
    '<meta http-equiv="Content-Security-Policy" content="' + contentSecurityPolicy + '">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<style>" + readerStyles + "</style></head><body>" +
    markup +
    "</body></html>"
  );
}

export default function EmailHtmlViewer({ html, plainTextBody }: EmailHtmlViewerProps) {
  const [loadRemoteImages, setLoadRemoteImages] = useState(false);
  const [showPlainText, setShowPlainText] = useState(false);
  const safeMarkup = useMemo(() => sanitizeEmailMarkup(html), [html]);
  const hasRemoteContent = useMemo(() => hasRemoteAssets(safeMarkup), [safeMarkup]);
  const documentSource = useMemo(
    () => buildSandboxDocument(safeMarkup, loadRemoteImages),
    [safeMarkup, loadRemoteImages],
  );

  return (
    <section className={styles.viewer} aria-label="Email message content">
      <div className={styles.toolbar}>
        <span className={styles.contentType}>{showPlainText ? "Plain-text alternative" : "Designed HTML email"}</span>
        <button
          type="button"
          className={styles.textToggle}
          onClick={() => setShowPlainText((current) => !current)}
          aria-pressed={showPlainText}
        >
          {showPlainText ? "View designed email" : "Plain text"}
        </button>
      </div>

      {showPlainText ? (
        <div className={styles.plainText}>
          {plainTextBody.trim() || "No plain-text alternative is available for this message."}
        </div>
      ) : (
        <>
          {hasRemoteContent && !loadRemoteImages && (
            <div className={styles.privacyNotice} role="note">
              <span>Remote images are blocked to protect your privacy. Loading them may notify the sender that you opened this email.</span>
              <button
                type="button"
                className={styles.loadImagesButton}
                onClick={() => setLoadRemoteImages(true)}
              >
                Load images
              </button>
            </div>
          )}
          <iframe
            className={styles.frame}
            title="Designed email content"
            srcDoc={documentSource}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </>
      )}
    </section>
  );
}
