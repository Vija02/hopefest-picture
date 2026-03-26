import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import EventGalleryPage from "./pages/EventGalleryPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:eventSlug" element={<EventGalleryPage />} />
      </Routes>
    </BrowserRouter>
  );
}
