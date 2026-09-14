"use client";

import { useState } from "react";

export type MediaItem = {
  kind: "photo" | "video";
  url: string;
  thumb?: string | null;
  source?: string;
  embed?: string;
};

export function MediaGallery({ items }: { items: MediaItem[] }) {
  const [active, setActive] = useState<MediaItem | null>(null);
  if (!items.length) return null;

  return (
    <section className="media-gallery" aria-label="Photos and videos">
      <h2>Photos and videos</h2>
      <p className="directory-meta">From the official website and official Facebook page.</p>
      <ul className="media-strip">
        {items.map((item) => (
          <li key={item.url}>
            <button type="button" className="media-thumb" onClick={() => setActive(item)}>
              {item.thumb || item.kind === "photo" ? (
                <img src={item.thumb || item.url} alt="" />
              ) : (
                <span className="media-fallback">Video</span>
              )}
              {item.kind === "video" ? <span className="media-play">Video</span> : null}
            </button>
          </li>
        ))}
      </ul>
      {active ? (
        <div className="demo-modal-backdrop" role="presentation" onClick={() => setActive(null)}>
          <div className="media-lightbox" role="dialog" aria-label="Media" onClick={(event) => event.stopPropagation()}>
            {active.embed ? (
              <iframe title="Video" src={active.embed} allow="encrypted-media; picture-in-picture" allowFullScreen />
            ) : active.kind === "video" ? (
              <p>
                <a href={active.url} target="_blank" rel="noreferrer">
                  Open video
                </a>
              </p>
            ) : (
              <img src={active.url} alt="" />
            )}
            <p>{active.source}</p>
            <button type="button" className="secondary" onClick={() => setActive(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
