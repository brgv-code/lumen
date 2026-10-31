import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Image as ImageIcon, Link2, Share2 } from "lucide-react";
import { Modal, Segmented, useToast } from "./ui";
import { api } from "../lib/api";
import { FORMATS, captions, ensureFonts, renderCard, type CardData, type CardFormat, type CardTheme } from "../lib/cards";

type Platform = "x" | "linkedin" | "threads" | "bluesky" | "whatsapp";
const PLATFORMS: { id: Platform; label: string; format: CardFormat; limit: number; url: (text: string, link: string) => string }[] = [
  { id: "x", label: "X", format: "link", limit: 280, url: (t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}` },
  { id: "linkedin", label: "LinkedIn", format: "portrait", limit: 3000, url: (_t, l) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(l)}` },
  { id: "threads", label: "Threads", format: "portrait", limit: 500, url: (t) => `https://www.threads.net/intent/post?text=${encodeURIComponent(t)}` },
  { id: "bluesky", label: "Bluesky", format: "link", limit: 300, url: (t) => `https://bsky.app/intent/compose?text=${encodeURIComponent(t)}` },
  { id: "whatsapp", label: "WhatsApp", format: "story", limit: 4000, url: (t) => `https://wa.me/?text=${encodeURIComponent(t)}` },
];

export function ShareModal({ data, refId, title, onClose }: { data: CardData | null; refId?: string; title: string; onClose: () => void }) {
  const toast = useToast();
  const preview = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<CardFormat>("link");
  const [theme, setTheme] = useState<CardTheme>("lamp");
  const [platform, setPlatform] = useState<Platform>("x");
  const [link, setLink] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [ready, setReady] = useState(false);

  // create the public link once, with a 1200x630 preview image for unfurls
  useEffect(() => {
    if (!data) return;
    setLink(null); setReady(false);
    (async () => {
      await ensureFonts();
      setReady(true);
      const off = document.createElement("canvas");
      renderCard(off, data, "link", "lamp");
      const image = off.toDataURL("image/jpeg", 0.88);
      try {
        const r = await api.createShare({ kind: data.kind, refId, title, payload: data, image });
        setLink(r.url);
      } catch (e) { toast((e as Error).message, "err"); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => { if (data && ready && preview.current) renderCard(preview.current, data, format, theme); }, [data, ready, format, theme]);
  useEffect(() => { if (data) setCaption(captions(data, link ?? "…")[platform]); }, [data, link, platform]);

  if (!data) return null;
  const P = PLATFORMS.find((x) => x.id === platform)!;

  const blob = () => new Promise<Blob>((res) => {
    const c = document.createElement("canvas");
    renderCard(c, data, format, theme);
    c.toBlob((b) => res(b!), "image/png");
  });
  const fileName = `lumen-${data.kind}-${format}.png`;

  const download = async () => {
    const b = await blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = fileName; a.click(); URL.revokeObjectURL(a.href);
    toast("Card downloaded");
  };
  const copyImage = async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob() })]); toast("Image copied. Paste it into your post."); }
    catch { download(); }
  };
  const nativeShare = async () => {
    const f = new File([await blob()], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], text: caption, url: link ?? undefined }).catch(() => {});
    else if (link) { await navigator.clipboard.writeText(link); toast("Link copied"); }
  };
  const openPlatform = async () => {
    // most platforms take text in the intent but not an image: copy the card so it can be pasted
    if (platform !== "linkedin") try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob() })]); } catch { /* */ }
    else await navigator.clipboard.writeText(caption).catch(() => {});
    window.open(P.url(caption, link ?? ""), "_blank", "noopener,width=720,height=720");
    toast(platform === "linkedin" ? "Caption copied: paste it into the post" : "Card copied: paste it into the post");
  };

  return (
    <Modal open onClose={onClose} title="Share">
      <div className="share">
        <div className="share__preview" style={{ aspectRatio: `${FORMATS[format].w} / ${FORMATS[format].h}` }}>
          <canvas ref={preview} />
          {!ready && <div className="skeleton" style={{ position: "absolute", inset: 0 }} />}
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <Segmented label="Format" size="sm" value={format} onChange={setFormat} options={(Object.keys(FORMATS) as CardFormat[]).map((f) => ({ value: f, label: FORMATS[f].label }))} />
          <div className="row small muted" style={{ marginTop: -4 }}>{FORMATS[format].hint} · {FORMATS[format].w}×{FORMATS[format].h}</div>
          <div className="row" style={{ gap: 8 }}>
            {(["lamp", "iris", "light", "dark"] as CardTheme[]).map((t) => (
              <button key={t} aria-pressed={theme === t} className={`theme-dot theme-dot--${t}`} title={t} onClick={() => setTheme(t)} />
            ))}
            <span className="spacer" />
            <button className="key key--ghost key--sm" onClick={copyImage}><ImageIcon size={14} /> Copy image</button>
            <button className="key key--ghost key--sm" onClick={download}><Download size={14} /> PNG</button>
          </div>
          <div className="share__platforms">
            {PLATFORMS.map((x) => (
              <button key={x.id} aria-pressed={platform === x.id} onClick={() => { setPlatform(x.id); setFormat(x.format); }}>{x.label}</button>
            ))}
          </div>
          <textarea className="textarea" rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <div className="row small" style={{ marginTop: -4 }}>
            <span className={caption.length > P.limit ? "" : "muted"} style={caption.length > P.limit ? { color: "var(--peach)" } : undefined}>{caption.length}/{P.limit}</span>
            <span className="spacer" />
            {link ? <a className="muted" href={link} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{link.replace(/^https?:\/\//, "")}</a> : <span className="muted">Creating link…</span>}
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="key key--lamp" disabled={!link} onClick={openPlatform}><Share2 size={15} /> Post to {P.label}</button>
            <button className="key key--ghost" disabled={!link} onClick={async () => { await navigator.clipboard.writeText(link!); toast("Link copied"); }}><Link2 size={15} /> Copy link</button>
            {"share" in navigator && <button className="key key--quiet" onClick={nativeShare}><Copy size={15} /> More…</button>}
          </div>
          <p className="small muted"><Check size={12} style={{ display: "inline", verticalAlign: -1 }} /> The link shows a card with only what you chose to share, and a small “Read with Lumen” pill.</p>
        </div>
      </div>
    </Modal>
  );
}
