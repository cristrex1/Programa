import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Tienda from "./Tienda.jsx";

const esTienda = window.location.pathname.startsWith("/tienda");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {esTienda ? <Tienda /> : <App />}
  </React.StrictMode>
);
