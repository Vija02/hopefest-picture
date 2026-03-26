import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";

import {
  Box,
  Button,
  ButtonGroup,
  Heading,
  Image,
  Stack,
  Text,
  useBreakpoint,
  Alert,
  AlertIcon,
  Spinner,
  Center,
} from "@chakra-ui/react";
import { Masonry } from "masonic";
import { useCallback, useEffect, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import Uppy from "@uppy/core";
import { Dashboard, DashboardModal } from "@uppy/react";
import Tus from "@uppy/tus";
import axios from "axios";
import Lightbox from "yet-another-react-lightbox";
import Download from "yet-another-react-lightbox/plugins/download";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import { create } from "zustand";
import { config } from "../config";

interface Event {
  id: number;
  name: string;
  slug: string;
  start_time: string;
  end_time: string;
}

interface SlideStoreState {
  slideIndex: number;
  slideIsOpen: boolean;
  closeSlide: () => void;
  openSlide: (slideIndex: number) => void;
  setSlideIndex: (slideIndex: number) => void;
}

const useSlideStore = create<SlideStoreState>((set) => ({
  slideIndex: 0,
  slideIsOpen: false,
  closeSlide: () => set({ slideIsOpen: false }),
  openSlide: (slideIndex: number) => set({ slideIndex, slideIsOpen: true }),
  setSlideIndex: (slideIndex: number) => set({ slideIndex }),
}));

const EasyMasonryComponent = ({ data }: { data: any[] }) => {
  return <Masonry items={data} columnGutter={8} render={ImgRenderer} />;
};

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

const ImgRenderer = (props: any) => {
  const {
    index,
    data: {
      id,
      src,
      size: { width: imgWidth, height: imgHeight },
    },
    width,
  } = props;

  const openSlide = useSlideStore((state) => state.openSlide);

  return (
    <Box width={width} height={(imgHeight * width) / imgWidth}>
      <Image
        id={id}
        src={src}
        alt=""
        onClick={() => openSlide(index)}
        cursor="pointer"
        sizes={`${width}px`}
        srcSet={calculateSrcSet(src, imgWidth)
          .map((x) => `${x.src} ${x.width}w`)
          .join(", ")}
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
    return (
      <Alert status="info" borderRadius="md">
        <AlertIcon />
        <Text>This event is no longer accepting photo uploads.</Text>
      </Alert>
    );
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

const LightBoxComponent = ({ data }: { data: any[] }) => {
  const slideState = useSlideStore();

  return (
    <Lightbox
      open={slideState.slideIsOpen}
      index={slideState.slideIndex}
      close={() => slideState.closeSlide()}
      on={{
        view: ({ index: currentIndex }) =>
          slideState.setSlideIndex(currentIndex),
      }}
      slides={data.map((x: any) => ({
        src: x.src,
        srcSet: calculateSrcSet(x.src, x.width) as any,
      }))}
      plugins={[Counter, Download, Fullscreen, Slideshow]}
    />
  );
};

const isEventActive = (startTime: string, endTime: string) => {
  const now = new Date();
  return new Date(startTime) <= now && new Date(endTime) >= now;
};

type SortOption = "photo_date" | "upload_date";

export default function EventGalleryPage() {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("photo_date");

  const isAcceptingUploads = event
    ? isEventActive(event.start_time, event.end_time)
    : false;

  const getPics = useCallback(() => {
    if (!eventSlug) return;
    axios.get(`/pictures/${eventSlug}?sort=${sortBy}`).then((res) => {
      setData(res.data);
    });
  }, [eventSlug, sortBy]);

  useEffect(() => {
    if (!eventSlug) return;

    // Fetch event details
    axios
      .get(`/api/events/${eventSlug}`)
      .then((res) => {
        setEvent(res.data);
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
  }, [eventSlug, getPics]);

  const breakpoint = useBreakpoint();

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
      <Stack
        bgColor="#1B2829"
        px={2}
        py={2}
        textAlign="center"
        color="gray.100"
        pb={{ base: 4, md: 8 }}
        mb={4}
        direction={{ base: "row", sm: "column" }}
        alignItems="center"
      >
        <Image
          display="block"
          mx={{ base: "initial", sm: "auto" }}
          src="/hf25_logo_white.png"
          alt=""
          height={{ base: "65px", sm: "80px", md: "140px" }}
          width={{ base: "initial", sm: "initial" }}
        />
        <Box display="flex" alignItems="center" justifyContent="center">
          <Heading
            mb={{ base: "-15px", sm: "initial" }}
            fontSize={{ base: "xl", sm: "sm", md: "xl" }}
          >
            {breakpoint === "base" ? event.name : `${event.name} GALLERY`}
          </Heading>
        </Box>
      </Stack>
      <Box
        bgColor="white"
        maxW={1210}
        margin="auto"
        px={{ base: "8px", md: "16px" }}
        py="16px"
        boxShadow="md"
      >
        <Upload getPics={getPics} isAcceptingUploads={isAcceptingUploads} />
        <Box mb={4} />
        {data.length > 0 && (
          <Box
            mb={4}
            display="flex"
            justifyContent="flex-end"
            alignItems="center"
            gap={2}
          >
            <Text fontSize="sm" color="gray.600">
              Sort by:
            </Text>
            <ButtonGroup size="sm" isAttached variant="outline">
              <Button
                onClick={() => setSortBy("photo_date")}
                colorScheme={sortBy === "photo_date" ? "blue" : "gray"}
                variant={sortBy === "photo_date" ? "solid" : "outline"}
              >
                Photo Date
              </Button>
              <Button
                onClick={() => setSortBy("upload_date")}
                colorScheme={sortBy === "upload_date" ? "blue" : "gray"}
                variant={sortBy === "upload_date" ? "solid" : "outline"}
              >
                Recent Uploads
              </Button>
            </ButtonGroup>
          </Box>
        )}
        {data.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500">No photos yet. Be the first to upload!</Text>
          </Box>
        ) : (
          <EasyMasonryComponent data={data} />
        )}
      </Box>
      <LightBoxComponent data={data} />
    </Box>
  );
}
