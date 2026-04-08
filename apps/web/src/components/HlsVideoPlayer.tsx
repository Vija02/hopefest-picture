import { Box, Text } from "@chakra-ui/react";
import {
  createPlayer,
  selectControls,
  useMedia,
  usePlayer,
} from "@videojs/react";
import { HlsVideo } from "@videojs/react/media/hls-video";
import { MinimalVideoSkin, videoFeatures } from "@videojs/react/video";
import "@videojs/react/video/minimal-skin.css";
import Hls from "hls.js";
import { memo, useCallback, useEffect, useRef, useState } from "react";

const Player = createPlayer({ features: videoFeatures });

interface QualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

function QualitySelector() {
  const media = useMedia();
  const controls = usePlayer(selectControls);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [isAuto, setIsAuto] = useState(true);
  const [activeLevel, setActiveLevel] = useState(-1); // The actual playing level
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const visible = controls?.controlsVisible ?? true;

  useEffect(() => {
    if (!media) return;

    let cleanedUp = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let boundHls: Hls | null = null;

    const updateLevels = (hls: Hls) => {
      const hlsLevels = hls.levels;
      if (!hlsLevels || hlsLevels.length <= 1) {
        setLevels([]);
        return;
      }

      const mapped: QualityLevel[] = hlsLevels
        .map((level, index) => ({
          index,
          height: level.height,
          width: level.width,
          bitrate: level.bitrate,
          label: level.height
            ? `${level.height}p`
            : `${Math.round(level.bitrate / 1000)}k`,
        }))
        .sort((a, b) => b.height - a.height);

      setLevels(mapped);
    };

    const onLevelSwitched = (_event: string, data: { level: number }) => {
      setActiveLevel(data.level);
    };

    const tryBind = () => {
      if (cleanedUp) return;

      // The HlsMedia instance exposes the hls.js engine directly
      const hls: Hls | null = (media as any).engine ?? null;

      if (!hls) {
        // Engine not ready yet, retry
        pollTimer = setTimeout(tryBind, 200);
        return;
      }

      boundHls = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => updateLevels(hls));
      hls.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);

      // In case manifest is already parsed
      if (hls.levels && hls.levels.length > 0) {
        updateLevels(hls);
      }
    };

    tryBind();

    return () => {
      cleanedUp = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (boundHls) {
        boundHls.off(Hls.Events.MANIFEST_PARSED, updateLevels as any);
        boundHls.off(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
      }
    };
  }, [media]);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectLevel = useCallback(
    (levelIndex: number) => {
      if (!media) return;
      const hls: Hls | null = (media as any).engine ?? null;
      if (!hls) return;

      if (levelIndex === -1) {
        hls.currentLevel = -1;
        setIsAuto(true);
      } else {
        hls.currentLevel = levelIndex;
        setIsAuto(false);
      }
      setOpen(false);
    },
    [media],
  );

  if (levels.length === 0) return null;

  const currentLabel = isAuto
    ? "Auto"
    : (levels.find((l) => l.index === activeLevel)?.label ?? "Auto");

  return (
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        zIndex: 20,
        opacity: visible || open ? 1 : 0,
        pointerEvents: visible || open ? "auto" : "none",
        transition: "opacity 150ms ease-out",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "rgba(0,0,0,0.6)",
          color: "white",
          border: "none",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {currentLabel}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(16px)",
            borderRadius: 8,
            padding: 4,
            minWidth: 120,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <button
            onClick={() => selectLevel(-1)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: isAuto ? "rgba(255,255,255,0.15)" : "transparent",
              color: "white",
              border: "none",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: isAuto ? 600 : 400,
            }}
          >
            Auto
          </button>
          {levels.map((level) => {
            const isActive = !isAuto && level.index === activeLevel;
            return (
              <button
                key={level.index}
                onClick={() => selectLevel(level.index)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: isActive
                    ? "rgba(255,255,255,0.15)"
                    : "transparent",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  padding: "6px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {level.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface HlsVideoPlayerProps {
  url: string;
  title: string;
}

export const HlsVideoPlayer = memo(({ url, title }: HlsVideoPlayerProps) => {
  return (
    <Box>
      {title && (
        <Text fontSize="md" fontWeight="bold" color="gray.600" mb={1} px={1}>
          {title}
        </Text>
      )}
      <Box borderRadius="lg" overflow="hidden" position="relative">
        <Player.Provider>
          <QualitySelector />
          <MinimalVideoSkin>
            <HlsVideo src={url} />
          </MinimalVideoSkin>
        </Player.Provider>
      </Box>
    </Box>
  );
});
