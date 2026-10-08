import { FlightFareHistoryChart } from "@/components/FlightFareHistoryChart";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 md:p-12 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
            Flyvis Price Intelligence
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Recorded Fare History (DEL → DXB)
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Actual daily flight fares recorded over the past 7 days from live quote intelligence
          </p>
        </div>

        <FlightFareHistoryChart />
      </div>
    </div>
  );
}
