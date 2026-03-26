import {
  Badge,
  Box,
  Container,
  Heading,
  LinkBox,
  LinkOverlay,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import axios from "axios";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

interface Event {
  id: number;
  name: string;
  slug: string;
  location: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  start_time: string;
  end_time: string;
  picture_count: number;
}

const isEventActive = (startTime: string, endTime: string) => {
  const now = new Date();
  return new Date(startTime) <= now && new Date(endTime) >= now;
};

const isEventEnded = (endTime: string) => {
  return new Date(endTime) < new Date();
};

const formatEventDate = (startTime: string | null, endTime: string | null) => {
  if (!startTime) return null;

  const start = new Date(startTime);
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  if (!endTime || start.toDateString() === new Date(endTime).toDateString()) {
    return start.toLocaleDateString("en-US", formatOptions);
  }

  return `${start.toLocaleDateString("en-US", formatOptions)} - ${new Date(endTime).toLocaleDateString("en-US", formatOptions)}`;
};

const EventCard = ({ event }: { event: Event }) => {
  const active = isEventActive(event.start_time, event.end_time);
  const ended = isEventEnded(event.end_time);
  const eventDate = formatEventDate(
    event.event_start_time,
    event.event_end_time,
  );

  return (
    <LinkBox
      as="article"
      p={5}
      borderWidth="1px"
      borderRadius="lg"
      bg="white"
      boxShadow="md"
      transition="all 0.2s"
      _hover={{ transform: "translateY(-4px)", boxShadow: "lg" }}
    >
      <VStack align="start" spacing={3}>
        <Badge colorScheme={active ? "green" : ended ? "gray" : "yellow"}>
          {active ? "Accepting Uploads" : ended ? "Ended" : "Upcoming"}
        </Badge>
        <Heading size="md">
          <LinkOverlay as={RouterLink} to={`/${event.slug}`}>
            {event.name}
          </LinkOverlay>
        </Heading>
        <VStack align="start" spacing={1}>
          {eventDate && (
            <Text
              fontSize="sm"
              color="gray.600"
              display="flex"
              alignItems="center"
              gap={1}
            >
              <span>📅</span> {eventDate}
            </Text>
          )}
          {event.location && (
            <Text
              fontSize="sm"
              color="gray.600"
              display="flex"
              alignItems="center"
              gap={1}
            >
              <span>📍</span> {event.location}
            </Text>
          )}
          <Text
            fontSize="sm"
            color="gray.600"
            display="flex"
            alignItems="center"
            gap={1}
          >
            <span>📷</span> {event.picture_count}{" "}
            {event.picture_count === 1 ? "photo" : "photos"}
          </Text>
        </VStack>
      </VStack>
    </LinkBox>
  );
};

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Event Gallery";
  }, []);

  useEffect(() => {
    axios
      .get("/api/events/status/public")
      .then((res) => {
        setEvents(res.data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <Box bgColor="#F0F2F5" minH="100vh">
      <Box bgColor="#1B2829" px={2} py={8} textAlign="center" color="gray.100">
        <Heading size="xl" mb={2}>
          Event Gallery
        </Heading>
        <Text fontSize="lg" opacity={0.8}>
          Browse photos from our events
        </Text>
      </Box>

      <Container maxW="container.lg" py={8}>
        {loading ? (
          <Text textAlign="center">Loading events...</Text>
        ) : events.length === 0 ? (
          <Box
            textAlign="center"
            p={8}
            bg="white"
            borderRadius="lg"
            boxShadow="md"
          >
            <Text fontSize="lg" color="gray.600">
              No events available yet. Check back soon!
            </Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </SimpleGrid>
        )}
      </Container>
    </Box>
  );
}
