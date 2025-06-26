import { Routes } from "./Routes";
import { RouteProvider } from "./router";

export default function App() {
  return (
    <RouteProvider>
      <Routes />
    </RouteProvider>
  );
}
