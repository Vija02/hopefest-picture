import { Box, Button, Center, Heading, Spinner, Text } from "@chakra-ui/react";
import Uppy from "@uppy/core";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import { Dashboard } from "@uppy/react";
import Tus from "@uppy/tus";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";

import { config, getUserId } from "../config";

interface Event {
  id: number;
  name: string;
  slug: string;
  start_time: string;
  end_time: string;
}

const isEventActive = (startTime: string, endTime: string) => {
  const now = new Date();
  return new Date(startTime) <= now && new Date(endTime) >= now;
};

export default function OfficialUploadPage() {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(0);

  const isAcceptingUploads = event
    ? isEventActive(event.start_time, event.end_time)
    : false;

  const [uppy] = useState(() =>
    new Uppy({ restrictions: { allowedFileTypes: ["image/*"] } }).use(Tus, {
      endpoint: config.tusdPath,
      onBeforeRequest: async (req) => {
        const uploaderId = getUserId();
        req.setHeader(
          "Upload-Metadata",
          req.getHeader("Upload-Metadata") +
            `,uploaderId ${btoa(uploaderId)},isOfficial ${btoa("true")}`,
        );
      },
    }),
  );

  const onComplete = useCallback(() => {
    setUploadCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    uppy.on("complete", onComplete);
    return () => {
      uppy.off("complete", onComplete);
    };
  }, [uppy, onComplete]);

  useEffect(() => {
    if (!eventSlug) return;

    axios
      .get(`/api/events/${eventSlug}`)
      .then((res) => {
        setEvent(res.data);
        document.title = `Official Upload - ${res.data.name}`;
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
      >
        <Heading
          fontSize={{ base: "lg", sm: "xl", md: "2xl" }}
          fontWeight="bold"
        >
          Official Photo Upload
        </Heading>
        <Text mt={2} color="gray.300">
          {event.name}
        </Text>
      </Box>

      <Box
        bgColor="white"
        maxW={800}
        margin="auto"
        px={{ base: "8px", md: "16px" }}
        py="16px"
        boxShadow="md"
      >
        {!isAcceptingUploads ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500" fontSize="lg">
              This event is not currently accepting uploads.
            </Text>
          </Box>
        ) : (
          <>
            <Text mb={4} color="gray.600" textAlign="center">
              Upload official highlight photos for this event. These will appear
              in the "Official Highlights / Photos" tab.
            </Text>
            <Dashboard width="100%" uppy={uppy} plugins={[]} />
            {uploadCount > 0 && (
              <Text mt={4} color="green.500" textAlign="center">
                {uploadCount} photo{uploadCount !== 1 ? "s" : ""} uploaded
                successfully!
              </Text>
            )}
          </>
        )}

        <Box textAlign="center" mt={6}>
          <Button
            as={RouterLink}
            to={`/${eventSlug}`}
            variant="outline"
            colorScheme="blue"
          >
            Back to Gallery
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
