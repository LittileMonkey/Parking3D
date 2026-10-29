import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { useEffect, useRef, useState } from "react";
import { parseSlotStatusChanged, type SlotStatusChange } from "./parkingRealtime";

export type ParkingHubStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

const hubUrl = import.meta.env.VITE_PARKING_HUB_URL || "/hubs/parking";

export function useParkingHub(
  enabled: boolean,
  parkingLotId: string | null,
  onSlotStatusChanges: (changes: SlotStatusChange[]) => void,
): ParkingHubStatus {
  const [status, setStatus] = useState<ParkingHubStatus>("disconnected");
  const onSlotStatusChangesRef = useRef(onSlotStatusChanges);
  onSlotStatusChangesRef.current = onSlotStatusChanges;

  useEffect(() => {
    if (!enabled || !parkingLotId) {
      setStatus("disconnected");
      return;
    }

    let active = true;
    let retryTimer: number | undefined;
    let flushFrame: number | undefined;
    const queuedChanges = new Map<string, SlotStatusChange>();
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => sessionStorage.getItem("parking.accessToken") ?? "",
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Warning)
      .build();

    const flushChanges = () => {
      flushFrame = undefined;
      if (!active || queuedChanges.size === 0) return;
      const changes = [...queuedChanges.values()];
      queuedChanges.clear();
      onSlotStatusChangesRef.current(changes);
    };

    const handleSlotStatusChanged = (payload: unknown) => {
      const change = parseSlotStatusChanged(payload);
      if (!change || (change.parkingLotId && change.parkingLotId !== parkingLotId)) return;
      queuedChanges.set(change.slotId, change);
      if (flushFrame === undefined) flushFrame = window.requestAnimationFrame(flushChanges);
    };

    const scheduleRetry = () => {
      if (!active || retryTimer !== undefined) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        void start();
      }, 5_000);
    };

    const start = async () => {
      if (!active) return;
      setStatus("connecting");
      try {
        await connection.start();
        if (active) setStatus("connected");
        else await connection.stop();
      } catch {
        if (!active) return;
        setStatus("disconnected");
        scheduleRetry();
      }
    };

    connection.on("SlotStatusChanged", handleSlotStatusChanged);
    connection.onreconnecting(() => {
      if (active) setStatus("reconnecting");
    });
    connection.onreconnected(() => {
      if (active) setStatus("connected");
    });
    connection.onclose(() => {
      if (!active) return;
      setStatus("disconnected");
      scheduleRetry();
    });
    void start();

    return () => {
      active = false;
      connection.off("SlotStatusChanged", handleSlotStatusChanged);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (flushFrame !== undefined) window.cancelAnimationFrame(flushFrame);
      queuedChanges.clear();
      void connection.stop();
    };
  }, [enabled, parkingLotId]);

  return status;
}
