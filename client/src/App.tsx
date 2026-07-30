import { Route, Routes } from "react-router-dom";
import { Home } from "./components/Home";
import { Room } from "./components/Room";

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:code" element={<Room />} />
      </Routes>
    </div>
  );
}
