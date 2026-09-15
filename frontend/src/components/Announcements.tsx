import { useEffect, useRef, useState } from 'react';
import { Info, AlertTriangle, CheckCircle2, AlertCircle, X, ExternalLink } from 'lucide-react';

interface BroadcastRecord {
  id: string;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  pinned?: boolean;
  expires?: string;
  link?: string;
  targetId?: string;
}

interface BannerRecord {
  id: string;
  title?: string;
  content: string;
  image?: string;
  href?: string;
  width?: number | string;
  startDate?: string;
  expires?: string;
  targetId?: string;
}

interface BinShape {
  broadcasts?: BroadcastRecord[];
  banner?: BannerRecord | null;
}

const BAKED_BIN_ID = '6aa9513affd5d160530a2986';
const JSONBIN_BASE = () => localStorage.getItem('newsMeva_jsonbinBase') || 'https://api.jsonbin.io/v3/b';
const JSONBIN_LATEST = (id: string) => `${JSONBIN_BASE()}/${id}/latest`;
const ANNOUNCEMENTS_API = () => localStorage.getItem('newsMeva_announcementsApi') || 'https://newsmeva.pages.dev/api/announcements';
const ANNOUNCEMENTS_URL = () => ANNOUNCEMENTS_API().replace(/\/+$/, '');

const POLL_SECONDS = 60;
const BANNER_COUNTDOWN_SECONDS = 7;
const DEVICE_ID_KEY = 'newsMeva_deviceId';
const DISMISSED_KEY = 'newsMeva_dismissedBroadcasts';

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

function getDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveDismissed(id: string) {
  const s = getDismissed();
  s.add(id);
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]));
  } catch {}
}

function isWithinPeriod(startDate?: string, expires?: string) {
  const now = new Date();
  if (startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime()) && now < d) return false;
  }
  if (expires) {
    const d = new Date(expires);
    if (!isNaN(d.getTime()) && now > d) return false;
  }
  return true;
}

function matchesDevice(record: { targetId?: string }) {
  return !record.targetId || record.targetId === getDeviceId();
}

function safeUrl(value?: string) {
  if (!value) return null;
  try {
    return new URL(value, window.location.href).href;
  } catch {
    return null;
  }
}

const pillStyles: Record<string, string> = {
  info: 'bg-blue-600',
  warning: 'bg-warning-500',
  success: 'bg-success-500',
  error: 'bg-danger-500',
};

const pillIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: AlertCircle,
};

export default function Announcements() {
  const [pills, setPills] = useState<BroadcastRecord[]>([]);
  const [banner, setBanner] = useState<BannerRecord | null>(null);
  const [countdown, setCountdown] = useState(BANNER_COUNTDOWN_SECONDS);
  const [bannerReady, setBannerReady] = useState(false);
  const bannerShownRef = useRef(false);
  const countdownRef = useRef(BANNER_COUNTDOWN_SECONDS);

  async function fetchAnnouncements(): Promise<BinShape | null> {
    try {
      const viaProxy = await fetch(ANNOUNCEMENTS_URL(), { cache: 'no-store' });
      if (viaProxy.ok) {
        const j = (await viaProxy.json()) as { record?: BinShape } | BinShape;
        const rec = (j as { record?: BinShape }).record;
        return (rec ?? j) as BinShape;
      }
    } catch {}
    const id = localStorage.getItem('newsMeva_broadcastBin') || BAKED_BIN_ID;
    if (!id) return null;
    try {
      const r = await fetch(JSONBIN_LATEST(id), { cache: 'no-store' });
      if (!r.ok) return null;
      const j = (await r.json()) as { record?: BinShape } | BinShape;
      const rec = (j as { record?: BinShape }).record;
      return (rec ?? j) as BinShape;
    } catch {
      return null;
    }
  }

  function applyBroadcasts(data: BinShape | null) {
    const list = (Array.isArray(data?.broadcasts) ? data.broadcasts : []).filter(
      (b) => b && b.id && b.message
    );
    const dismissed = getDismissed();
    setPills(
      list.filter(
        (b) =>
          isWithinPeriod(undefined, b.expires) &&
          matchesDevice(b) &&
          (b.pinned || !dismissed.has(String(b.id)))
      )
    );
  }

  function applyBanner(data: BinShape | null) {
    if (bannerShownRef.current) return;
    const b = data?.banner;
    if (!b || !b.id || !b.content) return;
    if (!isWithinPeriod(b.startDate, b.expires) || !matchesDevice(b)) return;
    bannerShownRef.current = true;
    setBanner(b);
    setCountdown(BANNER_COUNTDOWN_SECONDS);
    countdownRef.current = BANNER_COUNTDOWN_SECONDS;
    setBannerReady(false);
  }

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchAnnouncements();
      if (cancelled) return;
      applyBroadcasts(data);
      applyBanner(data);
    };
    load();
    const poll = setInterval(load, POLL_SECONDS * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!banner || bannerReady) return;
    const timer = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) {
        clearInterval(timer);
        setBannerReady(true);
      } else {
        setCountdown(countdownRef.current);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [banner, bannerReady]);

  const dismissPill = (id: string) => {
    saveDismissed(id);
    setPills((prev) => prev.filter((p) => p.id !== id));
  };

  const typeFor = (b: BroadcastRecord) =>
    ['info', 'warning', 'success', 'error'].includes(b.type || '') ? (b.type as string) : 'info';

  return (
    <>
      {pills.length > 0 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[9998] flex flex-col gap-2 pointer-events-none"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 76px)',
            width: 'min(92vw, 560px)',
          }}
        >
          {pills.map((b) => {
            const t = typeFor(b) as keyof typeof pillIcons;
            const Icon = pillIcons[t];
            const cls = pillStyles[t];
            const link = safeUrl(b.link);
            const inner = (
              <>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 min-w-0 leading-snug">
                  {b.title && <strong className="mr-1">{b.title}</strong>}
                  {b.message}
                  {b.link && <ExternalLink className="w-3.5 h-3.5 inline ml-1.5 opacity-80" />}
                </span>
                {!b.pinned && (
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => dismissPill(b.id)}
                    className="shrink-0 p-0.5 rounded opacity-80 hover:opacity-100 hover:bg-white/20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </>
            );
            const pillCls = `pointer-events-auto flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg ${cls} animate-slide-up`;
            return link ? (
              <a
                key={b.id}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className={pillCls}
              >
                {inner}
              </a>
            ) : (
              <div key={b.id} className={pillCls}>
                {inner}
              </div>
            );
          })}
        </div>
      )}

      {banner && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl w-full overflow-hidden relative shadow-2xl"
            style={banner.width ? { maxWidth: `${banner.width}px` } : { maxWidth: '480px' }}
          >
            <div className="absolute top-2 right-2 z-10">
              {bannerReady ? (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setBanner(null)}
                  className="bg-black/60 text-white p-1.5 rounded-lg hover:bg-black/80"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <span className="bg-black/60 text-white text-sm font-semibold px-2.5 py-1 rounded-lg">
                  {countdown}
                </span>
              )}
            </div>
            <div
              className="cursor-pointer"
              onClick={(e) => {
                if (e.target === e.currentTarget && bannerReady) setBanner(null);
              }}
            >
              {banner.href ? (
                <a href={safeUrl(banner.href) || '#'} target="_blank" rel="noopener noreferrer">
                  {bannerBody(banner)}
                </a>
              ) : (
                bannerBody(banner)
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function bannerBody(b: BannerRecord) {
  return (
    <div className="block">
      {b.image && (
        <img
          src={b.image}
          alt={b.title || ''}
          className="w-full max-h-[260px] object-cover"
        />
      )}
      <div className="p-5">
        {b.title && <h2 className="text-lg font-semibold text-surface-800 mb-2">{b.title}</h2>}
        <p className="text-sm text-surface-500 whitespace-pre-line m-0">{b.content}</p>
      </div>
    </div>
  );
}