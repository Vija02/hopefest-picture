import { Box, Text } from "@chakra-ui/react";
import { createPlayer } from "@videojs/react";
import { HlsVideo } from "@videojs/react/media/hls-video";
import { MinimalVideoSkin, videoFeatures } from "@videojs/react/video";
import "@videojs/react/video/minimal-skin.css";

const Player = createPlayer({ features: videoFeatures });

interface HlsVideoPlayerProps {
  url: string;
  title: string;
}

export const HlsVideoPlayer = ({ url, title }: HlsVideoPlayerProps) => {
  return (
    <Box>
      {title && (
        <Text fontSize="md" fontWeight="bold" color="gray.600" mb={1} px={1}>
          {title}
        </Text>
      )}
      <Box borderRadius="lg" overflow="hidden">
        <Player.Provider>
          <MinimalVideoSkin>
            <HlsVideo src={url} />
          </MinimalVideoSkin>
        </Player.Provider>
      </Box>
    </Box>
  );
};
