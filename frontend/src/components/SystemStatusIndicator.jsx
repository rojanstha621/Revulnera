import React from "react";

export default function SystemStatusIndicator({ health, queueBusy, workers }) {
  const redisOk = health?.redis === "ok";
  const celeryOk = health?.celery === "ok";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-sm font-semibold text-gray-300 mb-2">System Status</p>
      <div className="space-y-1 text-sm">
        <p className={redisOk ? "text-green-300" : "text-red-300"}>
          {redisOk ? "Green" : "Red"} Redis: {redisOk ? "OK" : "Down"}
        </p>
        <p className={queueBusy ? "text-yellow-300" : "text-green-300"}>
          {queueBusy ? "Yellow" : "Green"} Queue: {queueBusy ? "Busy" : "Healthy"}
        </p>
        <p className={celeryOk && workers > 0 ? "text-green-300" : "text-red-300"}>
          {celeryOk && workers > 0 ? "Green" : "Red"} Workers: {celeryOk && workers > 0 ? "Up" : "Down"}
        </p>
      </div>
    </div>
  );
}
