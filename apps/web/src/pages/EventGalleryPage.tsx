import {
  Box,
  Button,
  ButtonGroup,
  Center,
  Collapse,
  Heading,
  Image,
  Spinner,
  Text,
  useBreakpoint,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import Uppy from "@uppy/core";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import { Dashboard, DashboardModal } from "@uppy/react";
import Tus from "@uppy/tus";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import "yet-another-react-lightbox/styles.css";

import { HlsVideoPlayer } from "../components/HlsVideoPlayer";
import { VirtualizedMasonryGrid } from "../components/VirtualizedMasonryGrid";
import { config, getUserId } from "../config";

interface Video {
  id: number;
  title: string;
  url: string;
  event_id: number;
  sort_order: number;
}

// Helper to group pictures by date (for photo_date sorting)
const UNKNOWN_DATE_KEY = "unknown";

const groupByDate = (
  pictures: any[],
): { date: string; label: string; pictures: any[] }[] => {
  const groups: Record<string, any[]> = {};

  pictures.forEach((pic) => {
    // Only use exifCreatedAt for grouping (photo date from EXIF data)
    const dateStr = pic.exifCreatedAt;
    let dateKey = UNKNOWN_DATE_KEY;

    if (dateStr) {
      const date = new Date(dateStr);
      // Check if date is valid
      if (!isNaN(date.getTime())) {
        dateKey = date.toISOString().split("T")[0] as string; // YYYY-MM-DD
      }
    }

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(pic);
  });

  // Sort by date descending, with "unknown" at the bottom
  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (a === UNKNOWN_DATE_KEY) return 1;
      if (b === UNKNOWN_DATE_KEY) return -1;
      return b.localeCompare(a);
    })
    .map(([dateKey, pics]) => {
      if (dateKey === UNKNOWN_DATE_KEY) {
        return { date: dateKey, label: "Unknown", pictures: pics };
      }
      const date = new Date(dateKey + "T00:00:00");
      const label = date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return { date: dateKey, label, pictures: pics };
    });
};

// Flash highlight animation
const flashAnimation = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.8); }
  50% { box-shadow: 0 0 20px 10px rgba(66, 153, 225, 0.6); }
  100% { box-shadow: 0 0 0 0 rgba(66, 153, 225, 0); }
`;

interface Event {
  id: number;
  name: string;
  slug: string;
  location: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  start_time: string;
  end_time: string;
  background_image: string | null;
  logo: string | null;
}

const calculateSrcSet = (src: string, imgWidth: number) => {
  const fileSplit = src.split(".");
  const fileName = fileSplit.slice(0, -1).join(".");
  const fileExtension = fileSplit[fileSplit.length - 1];

  const sizes = [320, 640, 1200, 2048, 3840];

  return sizes
    .filter((size) => size < imgWidth)
    .map((size) => ({
      src: `${fileName}-${size}.${fileExtension}`,
      width: size,
    }));
};

// Gallery component with its own lightbox
const Gallery = ({
  data,
  title,
  showSortControls,
  sortBy,
  setSortBy,
  bgColor,
  borderColor,
  highlightedIds,
}: {
  data: any[];
  title?: string;
  showSortControls?: boolean;
  sortBy?: "photo_date" | "upload_date";
  setSortBy?: (sort: "photo_date" | "upload_date") => void;
  bgColor?: string;
  borderColor?: string;
  highlightedIds?: Set<number>;
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const renderImage = ({
    item: pictureData,
    index,
    width,
  }: {
    item: any;
    index: number;
    width: number;
    height: number;
  }) => {
    const {
      id,
      src,
      size: { width: imgWidth },
    } = pictureData;

    const isHighlighted = highlightedIds?.has(id);

    return (
      <Box
        width="100%"
        height="100%"
        animation={
          isHighlighted ? `${flashAnimation} 1.5s ease-out 3` : undefined
        }
        borderRadius="md"
        overflow="hidden"
        bg="gray.200"
      >
        <Image
          id={id}
          src={src}
          alt=""
          width="100%"
          height="100%"
          objectFit="cover"
          onClick={() => openLightbox(index)}
          cursor="pointer"
          loading="lazy"
          sizes={`${width}px`}
          srcSet={calculateSrcSet(src, imgWidth)
            .map((x) => `${x.src} ${x.width}w`)
            .join(", ")}
        />
      </Box>
    );
  };

  if (data.length === 0) return null;

  return (
    <Box mb={6}>
      {(title || showSortControls) && (
        <Box
          mb={3}
          display="flex"
          flexDirection={{ base: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ base: "flex-start", sm: "center" }}
          gap={2}
        >
          {title && (
            <Text fontSize="lg" fontWeight="semibold" color="gray.700">
              {title} ({data.length})
            </Text>
          )}
          {showSortControls && sortBy && setSortBy && (
            <Box display="flex" alignItems="center" gap={2}>
              <Text
                fontSize="sm"
                color="gray.600"
                display={{ base: "none", sm: "block" }}
              >
                Sort by:
              </Text>
              <ButtonGroup size="sm" isAttached variant="outline">
                <Button
                  onClick={() => setSortBy("photo_date")}
                  colorScheme={sortBy === "photo_date" ? "blue" : "gray"}
                  variant={sortBy === "photo_date" ? "solid" : "outline"}
                  fontSize={{ base: "xs", sm: "sm" }}
                  px={{ base: 2, sm: 3 }}
                >
                  Photo Date
                </Button>
                <Button
                  onClick={() => setSortBy("upload_date")}
                  colorScheme={sortBy === "upload_date" ? "blue" : "gray"}
                  variant={sortBy === "upload_date" ? "solid" : "outline"}
                  fontSize={{ base: "xs", sm: "sm" }}
                  px={{ base: 2, sm: 3 }}
                >
                  Recent Uploads
                </Button>
              </ButtonGroup>
            </Box>
          )}
        </Box>
      )}
      <Box
        p={bgColor ? 3 : 0}
        bg={bgColor}
        borderRadius={bgColor ? "md" : undefined}
        border={borderColor ? "1px solid" : undefined}
        borderColor={borderColor}
      >
        <VirtualizedMasonryGrid
          items={data}
          getItemWidth={(item: any) => item.size.width}
          getItemHeight={(item: any) => item.size.height}
          render={renderImage}
          itemKey={(item: any) => item.id}
          columnGap={8}
          rowGap={8}
          overscan={500}
        />
      </Box>
      <Lightbox
        open={lightboxOpen}
        index={lightboxIndex}
        close={() => setLightboxOpen(false)}
        on={{
          view: ({ index: currentIndex }) => setLightboxIndex(currentIndex),
        }}
        slides={data.map((x: any) => {
          const splitted = x.src.split("/");
          return {
            src: x.src,
            srcSet: calculateSrcSet(x.src, x.size.width) as any,
            download: {
              url: x.src,
              filename: splitted[splitted.length - 1],
            },
          };
        })}
        download={{
          download: ({ slide, saveAs }) => {
            const url =
              (typeof slide.download === "object" && slide.download.url) ||
              slide.src;
            const filename =
              (typeof slide.download === "object" && slide.download.filename) ||
              undefined;
            fetch(url)
              .then((res) => res.blob())
              .then((blob) => {
                const ext = url.split(".").pop()?.toLowerCase();
                const mimeMap: Record<string, string> = {
                  jpg: "image/jpeg",
                  jpeg: "image/jpeg",
                  png: "image/png",
                  gif: "image/gif",
                  webp: "image/webp",
                };
                const correctType =
                  (ext && mimeMap[ext]) || blob.type || "image/jpeg";
                saveAs(
                  new Blob([blob], { type: correctType }),
                  filename,
                );
              });
          },
        }}
        plugins={[Counter, Download, Fullscreen, Slideshow]}
      />
    </Box>
  );
};

const Upload = ({
  getPics,
  isAcceptingUploads,
}: {
  getPics: () => void;
  isAcceptingUploads: boolean;
}) => {
  const [uppy] = useState(() =>
    new Uppy({ restrictions: { allowedFileTypes: ["image/*"] } }).use(Tus, {
      endpoint: config.tusdPath,
      onBeforeRequest: async (req) => {
        // Add uploaderId to metadata
        const uploaderId = getUserId();
        req.setHeader(
          "Upload-Metadata",
          req.getHeader("Upload-Metadata") + `,uploaderId ${btoa(uploaderId)}`,
        );
      },
    }),
  );

  useEffect(() => {
    uppy.on("complete", () => {
      getPics();
    });
  }, [uppy, getPics]);

  const [open, setOpen] = useState(false);

  const breakpoint = useBreakpoint();

  if (!isAcceptingUploads) {
    return null;
  }

  return (
    <>
      {breakpoint === "base" ? (
        <>
          <Button
            variant="outline"
            borderRadius={0}
            w="100%"
            onClick={() => setOpen(!open)}
          >
            Upload image
          </Button>
          <DashboardModal open={open} uppy={uppy} plugins={[]} />
        </>
      ) : (
        <Dashboard width={1200} uppy={uppy} plugins={[]} />
      )}
    </>
  );
};

const MyUploadsSection = ({
  myUploads,
  highlightedIds,
}: {
  myUploads: any[];
  highlightedIds: Set<number>;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-open when there's a new highlighted upload
  useEffect(() => {
    if (highlightedIds.size > 0) {
      setIsOpen(true);
    }
  }, [highlightedIds.size]);
  // Track key to force Masonry re-render after collapse animation
  const [masonryKey, setMasonryKey] = useState(0);

  useEffect(() => {
    if (isOpen) {
      // Wait for collapse animation to complete then force Masonry re-render
      const timeout = setTimeout(() => {
        setMasonryKey((prev) => prev + 1);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  return (
    <Box mb={6}>
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        px={2}
        py={2}
        w="100%"
        justifyContent="flex-start"
        display="flex"
        alignItems="center"
        gap={2}
        fontWeight="semibold"
        color="gray.700"
        position="sticky"
        top={0}
        bg="white"
        zIndex={10}
        borderBottom="1px solid"
        borderColor="gray.200"
        borderRadius={0}
        _hover={{ bg: "gray.50" }}
      >
        <Text>{isOpen ? "▼" : "▶"}</Text>
        <Text>Your Uploads ({myUploads.length})</Text>
      </Button>
      <Collapse in={isOpen} animateOpacity>
        <Box
          p={3}
          bg="blue.50"
          borderRadius="md"
          border="1px solid"
          borderColor="blue.200"
        >
          <Gallery
            key={masonryKey}
            data={myUploads}
            highlightedIds={highlightedIds}
          />
        </Box>
      </Collapse>
    </Box>
  );
};

// Component to render pictures grouped by day
const GroupedByDayGallery = ({
  data,
  title,
  sortBy,
  setSortBy,
  highlightedIds,
}: {
  data: any[];
  title?: string;
  sortBy: "photo_date" | "upload_date";
  setSortBy: (sort: "photo_date" | "upload_date") => void;
  highlightedIds?: Set<number>;
}) => {
  const groups = groupByDate(data);

  return (
    <Box>
      {/* Sort controls at the top */}
      <Box
        mb={4}
        display="flex"
        flexDirection={{ base: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ base: "flex-start", sm: "center" }}
        gap={2}
      >
        {title && (
          <Text fontSize="lg" fontWeight="semibold" color="gray.700">
            {title} ({data.length})
          </Text>
        )}
        <Box display="flex" alignItems="center" gap={2}>
          <Text
            fontSize="sm"
            color="gray.600"
            display={{ base: "none", sm: "block" }}
          >
            Sort by:
          </Text>
          <ButtonGroup size="sm" isAttached variant="outline">
            <Button
              onClick={() => setSortBy("photo_date")}
              colorScheme={sortBy === "photo_date" ? "blue" : "gray"}
              variant={sortBy === "photo_date" ? "solid" : "outline"}
              fontSize={{ base: "xs", sm: "sm" }}
              px={{ base: 2, sm: 3 }}
            >
              Photo Date
            </Button>
            <Button
              onClick={() => setSortBy("upload_date")}
              colorScheme={sortBy === "upload_date" ? "blue" : "gray"}
              variant={sortBy === "upload_date" ? "solid" : "outline"}
              fontSize={{ base: "xs", sm: "sm" }}
              px={{ base: 2, sm: 3 }}
            >
              Recent Uploads
            </Button>
          </ButtonGroup>
        </Box>
      </Box>

      {/* Grouped sections */}
      {groups.map((group) => (
        <Box key={group.date} mb={6}>
          <Text
            fontSize="md"
            fontWeight="medium"
            color="gray.600"
            mb={2}
            pb={1}
            borderBottom="1px solid"
            borderColor="gray.200"
            position="sticky"
            top={0}
            bg="white"
            zIndex={10}
            py={2}
            mx={-2}
            px={2}
          >
            {group.label}
          </Text>
          <Gallery data={group.pictures} highlightedIds={highlightedIds} />
        </Box>
      ))}
    </Box>
  );
};

const isEventActive = (startTime: string, endTime: string) => {
  const now = new Date();
  return new Date(startTime) <= now && new Date(endTime) >= now;
};

type SortOption = "photo_date" | "upload_date";

type TabType = "moments" | "official";

export default function EventGalleryPage() {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [officialData, setOfficialData] = useState<any[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("photo_date");
  const [officialSortBy, setOfficialSortBy] =
    useState<SortOption>("photo_date");
  const [highlightedIds, setHighlightedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>("moments");

  const userId = getUserId();

  // Get user's uploads for the dedicated section
  const myUploads = data.filter((pic) => pic.uploaderId === userId);

  const isAcceptingUploads = event
    ? isEventActive(event.start_time, event.end_time)
    : false;

  const getPics = useCallback(() => {
    if (!eventSlug) return;
    axios.get(`/pictures/${eventSlug}?sort=${sortBy}`).then((res) => {
      setData(res.data);
    });
  }, [eventSlug, sortBy]);

  const getOfficialPics = useCallback(() => {
    if (!eventSlug) return;
    axios
      .get(`/pictures/${eventSlug}?sort=${officialSortBy}&official=true`)
      .then((res) => {
        setOfficialData(res.data);
      });
  }, [eventSlug, officialSortBy]);

  useEffect(() => {
    if (!eventSlug) return;

    // Fetch event details
    axios
      .get(`/api/events/${eventSlug}`)
      .then((res) => {
        setEvent(res.data);
        document.title = `${res.data.name} Gallery`;
        setError(null);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError("Event not found");
        } else {
          setError("Failed to load event");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    // Fetch pictures
    getPics();
    getOfficialPics();

    // Fetch videos
    axios
      .get(`/api/events/${eventSlug}/videos`)
      .then((res) => {
        setVideos(res.data);
      })
      .catch(() => {
        // Videos are optional, don't show error
      });
  }, [eventSlug, getPics, getOfficialPics]);

  // SSE for real-time updates with reconnection
  useEffect(() => {
    if (!eventSlug) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      eventSource = new EventSource(`/events/${eventSlug}/stream`);

      eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "new_picture") {
          const picture = message.picture;

          if (picture.isOfficial) {
            setOfficialData((prevData) => [picture, ...prevData]);
          } else {
            setData((prevData) => [picture, ...prevData]);

            // Highlight if it's the current user's upload
            if (picture.uploaderId === userId) {
              setHighlightedIds((prev) => new Set(prev).add(picture.id));
              // Remove highlight after animation completes (1.5s * 3 = 4.5s)
              setTimeout(() => {
                setHighlightedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(picture.id);
                  return next;
                });
              }, 5000);
            }
          }
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Reconnect after 3 seconds
        if (isMounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      eventSource?.close();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [eventSlug]);

  if (loading) {
    return (
      <Center minH="100vh" bgColor="#F0F2F5">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (error || !event) {
    return (
      <Box bgColor="#F0F2F5" minH="100vh" pt={8}>
        <Box
          textAlign="center"
          maxW="md"
          mx="auto"
          p={8}
          bg="white"
          borderRadius="lg"
          boxShadow="md"
        >
          <Heading size="lg" mb={4} color="red.500">
            {error || "Event not found"}
          </Heading>
          <Button as={RouterLink} to="/" colorScheme="blue">
            Back to Events
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box bgColor="#F0F2F5" minH="100vh">
      <Box
        bgColor="#1B2829"
        px={{ base: 4, md: 6 }}
        py={{ base: 4, md: 6 }}
        textAlign="center"
        color="gray.100"
        mb={4}
        backgroundImage={
          event.background_image ? `url(${event.background_image})` : undefined
        }
        backgroundSize="cover"
        backgroundPosition="center"
        position="relative"
        _before={
          event.background_image
            ? {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bg: "rgba(27, 40, 41, 0.3)",
              }
            : undefined
        }
      >
        <Box
          position="relative"
          zIndex={1}
          maxW="800px"
          mx="auto"
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap={{ base: 2, md: 4 }}
        >
          {event.logo && (
            <Box
              minH={{ base: "60px", sm: "80px", md: "120px" }}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Image
                src={event.logo}
                alt=""
                maxH={{ base: "60px", sm: "80px", md: "120px" }}
                maxW={{ base: "200px", sm: "280px", md: "400px" }}
                objectFit="contain"
              />
            </Box>
          )}
          <Heading
            fontSize={{ base: "lg", sm: "xl", md: "2xl" }}
            fontWeight="bold"
          >
            {event.name} GALLERY
          </Heading>
          {(event.location || event.event_start_time) && (
            <Box fontSize={{ base: "sm", md: "md" }} color="gray.300">
              {event.location && (
                <Text
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={1}
                >
                  <span>📍</span> {event.location}
                </Text>
              )}
              {event.event_start_time && (
                <Text
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={1}
                >
                  <span>📅</span>
                  {new Date(event.event_start_time).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                  {event.event_end_time &&
                    new Date(event.event_start_time).toDateString() !==
                      new Date(event.event_end_time).toDateString() &&
                    ` - ${new Date(event.event_end_time).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}`}
                </Text>
              )}
            </Box>
          )}
        </Box>
      </Box>
      {/* Videos - always visible */}
      {videos.length > 0 && (
        <Box
          maxW={1210}
          margin="auto"
          px={{ base: "8px", md: "16px" }}
          pt="16px"
          pb="16px"
        >
          <Text fontSize="lg" fontWeight="semibold" color="gray.700" mb={3}>
            Videos
          </Text>
          <Box
            display="grid"
            gridTemplateColumns={{
              base: "1fr",
              md: "repeat(2, 1fr)",
              xl: "repeat(3, 1fr)",
            }}
            gap={4}
          >
            {videos.map((video) => (
              <HlsVideoPlayer
                key={video.id}
                url={video.url}
                title={video.title}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Tabs */}
      <Box maxW={1210} margin="auto">
        <Box display="flex" borderBottom="2px solid" borderColor="gray.200">
          <Box
            flex={1}
            textAlign="center"
            py={3}
            px={4}
            cursor="pointer"
            fontWeight="semibold"
            fontSize={{ base: "sm", md: "md" }}
            color={activeTab === "moments" ? "blue.600" : "gray.500"}
            borderBottom="3px solid"
            borderColor={activeTab === "moments" ? "blue.600" : "transparent"}
            bg={activeTab === "moments" ? "white" : "transparent"}
            _hover={{ bg: "gray.50" }}
            onClick={() => setActiveTab("moments")}
            transition="all 0.2s"
          >
            Your Moments
          </Box>
          <Box
            flex={1}
            textAlign="center"
            py={3}
            px={4}
            cursor="pointer"
            fontWeight="semibold"
            fontSize={{ base: "sm", md: "md" }}
            color={activeTab === "official" ? "blue.600" : "gray.500"}
            borderBottom="3px solid"
            borderColor={activeTab === "official" ? "blue.600" : "transparent"}
            bg={activeTab === "official" ? "white" : "transparent"}
            _hover={{ bg: "gray.50" }}
            onClick={() => setActiveTab("official")}
            transition="all 0.2s"
          >
            Official Highlights
          </Box>
        </Box>
      </Box>

      <Box
        bgColor="white"
        maxW={1210}
        margin="auto"
        px={{ base: "8px", md: "16px" }}
        py="16px"
        boxShadow="md"
      >
        {activeTab === "moments" && (
          <>
            <Upload getPics={getPics} isAcceptingUploads={isAcceptingUploads} />
            <Box mb={4} />

            {/* My Uploads Section */}
            {myUploads.length > 0 && (
              <MyUploadsSection
                myUploads={myUploads}
                highlightedIds={highlightedIds}
              />
            )}

            {/* All Photos Section */}
            {data.length === 0 ? (
              <Box textAlign="center" py={8}>
                <Text color="gray.500">
                  No photos yet. Be the first to upload!
                </Text>
              </Box>
            ) : sortBy === "photo_date" ? (
              <GroupedByDayGallery
                data={data}
                title={myUploads.length > 0 ? "All Photos" : undefined}
                sortBy={sortBy}
                setSortBy={setSortBy}
                highlightedIds={highlightedIds}
              />
            ) : (
              <Gallery
                data={data}
                title={myUploads.length > 0 ? "All Photos" : undefined}
                showSortControls={true}
                sortBy={sortBy}
                setSortBy={setSortBy}
                highlightedIds={highlightedIds}
              />
            )}
          </>
        )}

        {activeTab === "official" && (
          <>
            {/* Official Photos Section */}
            {officialData.length === 0 ? (
              <Box textAlign="center" py={8}>
                <Text color="gray.500">No official photos yet.</Text>
              </Box>
            ) : officialSortBy === "photo_date" ? (
              <GroupedByDayGallery
                data={officialData}
                sortBy={officialSortBy}
                setSortBy={setOfficialSortBy}
              />
            ) : (
              <Gallery
                data={officialData}
                showSortControls={true}
                sortBy={officialSortBy}
                setSortBy={setOfficialSortBy}
              />
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
