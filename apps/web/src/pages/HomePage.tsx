import {
  Box,
  Container,
  Heading,
  SimpleGrid,
  Text,
  Badge,
  LinkBox,
  LinkOverlay,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import axios from "axios";

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

const isEventEnded = (endTime: string) => {
  return new Date(endTime) < new Date();
};

const EventCard = ({ event }: { event: Event }) => {
  const active = isEventActive(event.start_time, event.end_time);
  const ended = isEventEnded(event.end_time);

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
        <Text fontSize="sm" color="gray.600">
          {new Date(event.start_time).toLocaleDateString()} -{" "}
          {new Date(event.end_time).toLocaleDateString()}
        </Text>
      </VStack>
    </LinkBox>
  );
};

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

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
