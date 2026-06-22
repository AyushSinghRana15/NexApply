import { useEffect } from "react";
import { useWSStore } from "@/stores/useWSStore";

export function WebSocketInit() {
  const connect = useWSStore((s) => s.connect);
  const disconnect = useWSStore((s) => s.disconnect);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  return null;
}
