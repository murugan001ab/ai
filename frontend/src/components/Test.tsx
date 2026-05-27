import { useEffect } from "react";

export default function Test() {

  useEffect(() => {

    const ws = new WebSocket("ws://localhost:8000/ws/dashboard");

    ws.onopen = () => {
      ws.send("ping");
    };

    ws.onmessage = (e) => {
      console.log("RAW:", e.data);

      try {
        const data = JSON.parse(e.data);
        console.log("JSON:", data);
      } catch (err) {
        console.log("Not JSON:", e.data);
      }
    };

    return () => ws.close();

  }, []);

  return <></>;
}