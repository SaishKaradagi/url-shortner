import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

export const useBackendWakeup = () => {
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(true);

  useEffect(() => {
    const wakeUpBackend = async () => {
      console.log("🔄 Waking up backend...");
      setIsWakingUp(true);

      try {
        // First call: Quick liveness check (no DB)
        await axios.get(`${API_BASE_URL}/livez`, {
          timeout: 10000, // 10 second timeout
        });
        console.log("✅ Backend is alive");

        // Second call: Health check (with DB connection)
        await axios.get(`${API_BASE_URL}/health`, {
          timeout: 15000, // 15 second timeout
        });
        console.log("✅ Backend is fully ready");

        setIsBackendReady(true);
        setIsWakingUp(false);
      } catch (error) {
        console.error("❌ Backend wake-up failed:", error);

        // Retry once after 2 seconds
        setTimeout(async () => {
          try {
            await axios.get(`${API_BASE_URL}/livez`);
            setIsBackendReady(true);
            setIsWakingUp(false);
          } catch (retryError) {
            console.error("❌ Retry failed:", retryError);
            setIsWakingUp(false);
            // Still set ready to allow user to try
            setIsBackendReady(true);
          }
        }, 2000);
      }
    };

    wakeUpBackend();
  }, []);

  return { isBackendReady, isWakingUp };
};
