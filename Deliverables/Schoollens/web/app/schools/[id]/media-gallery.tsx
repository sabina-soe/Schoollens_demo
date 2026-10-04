"use client";

import { useState } from "react";
import { type MediaItem, usableMedia } from "@/lib/campus-media";

export type { MediaItem };

export function MediaGallery({ items }: { items: MediaItem[] }) {
  const [active, setActive] = useState<MediaItem | null>(null);
  const visible = usableMedia(items);
  if (!visible.length) return null;

  return (
    <section className="media-gallery" aria-label="Photos and videos">
      <h3 className="media-gallery-title">Photos and videos</h3>
      <p className="directory-meta">From the official website and official Facebook page.</p>
      <ul className="media-strip">
        {visible.map((item) => (
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
