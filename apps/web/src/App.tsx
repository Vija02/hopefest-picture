import { BrowserRouter, Route, Routes } from "react-router-dom";

import EventGalleryPage from "./pages/EventGalleryPage";
import HomePage from "./pages/HomePage";
import OfficialUploadPage from "./pages/OfficialUploadPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:eventSlug/official" element={<OfficialUploadPage />} />
        <Route path="/:eventSlug" element={<EventGalleryPage />} />
      </Routes>
    </BrowserRouter>
  );
}
