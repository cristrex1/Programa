import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Tienda from "./Tienda.jsx";

const esAdmin = window.location.pathname.startsWith("/admin");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {esAdmin ? <App /> : <Tienda />}
  </React.StrictMode>
);
