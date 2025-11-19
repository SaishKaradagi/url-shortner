import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import Nav from "./components/Nav";
import "./App.css";
import { useBackendWakeup } from "./hooks/useBackendWakeup";

// Loading component
const BackendWakingUp = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
      <h2 className="text-white text-xl font-semibold mb-2">
        Waking up the server...
      </h2>
      <p className="text-gray-400">This may take a few seconds on first load</p>
    </div>
  </div>
);

function App() {
  const { isBackendReady, isWakingUp } = useBackendWakeup();

  if (isWakingUp) {
    return <BackendWakingUp />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-[#0a0a0f]">
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
