import React from "react";
import { createRoot } from "react-dom/client";
import { Home } from "./pages";
import { GlobalStyles } from "twin.macro";

const app = document.getElementById("app");

createRoot(app).render(
  <React.StrictMode>
    <GlobalStyles />
    <Home />
  </React.StrictMode>
);