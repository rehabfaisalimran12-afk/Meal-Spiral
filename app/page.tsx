"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { evaluateRestrictionSignal } from "@/lib/safety-guard";
import type { SkipLog, Cluster, RiskScore } from "@/lib/types";
import LogForm from "@/app/components/LogForm";
import RecentLogs from "@/app/components/RecentLogs";
import ClustersSection from "@/app/components/ClustersSection";
import RiskSection from "@/app/components/RiskSection";
import SkipTrendChart from "@/app/components/SkipTrendChart";

export default function Dashboard() {
  // â”€â”€â”€ Logs section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [logs, setLogs] = useState<SkipLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  // All 14 logs kept for chart + guard (display slice of 10 passed to RecentLogs)
  const [all14Logs, setAll14Logs] = useState<SkipLog[]>([]);

  // â”€â”€â”€ Clusters section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [clustersLoading, setClustersLoading] = useState(true);
  const [clustersError, setClustersError] = useState<string | null>(null);

  // â”€â”€â”€ Risk section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [riskLoading, setRiskLoading] = useState(true);
  const [riskError, setRiskError] = useState<string | null>(null);

  // â”€â”€â”€ Safety Guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [restrictionActive, setRestrictionActive] = useState(false);

  const fetchAll = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    setClustersLoading(true);
    setClustersError(null);
    setRiskLoading(true);
    setRiskError(null);

    // Fire all three fetches simultaneously
    const [logsResult, clustersResult, riskResult] = await Promise.allSettled([
        // Fetch 14 logs: the guard needs 14, display only the first 10
        supabase
          .from("skip_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(14),

        fetch("/api/cluster", { method: "POST" }),

        fetch("/api/risk", { method: "POST" }),
      ]);

      // â”€â”€ Settle logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      let all14Logs: SkipLog[] = [];
      if (logsResult.status === "fulfilled") {
        const { data, error } = logsResult.value;
        if (error || !data) {
          setLogsError("Could not load recent logs.");
        } else {
          all14Logs = data as SkipLog[];
          setAll14Logs(all14Logs);
          // Display only the first 10
          setLogs(all14Logs.slice(0, 10));
        }
      } else {
        setLogsError("Could not load recent logs.");
      }
      setLogsLoading(false);

      // â”€â”€ Settle clusters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (clustersResult.status === "fulfilled") {
        const res = clustersResult.value;
        if (!res.ok) {
          setClustersError("Could not load patterns.");
        } else {
          try {
            const data: Cluster[] = await res.json();
            setClusters(data);
          } catch {
            setClustersError("Could not load patterns.");
          }
        }
      } else {
        setClustersError("Could not load patterns.");
      }
      setClustersLoading(false);

      // â”€â”€ Settle risk â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (riskResult.status === "fulfilled") {
        const res = riskResult.value;
        if (!res.ok) {
          setRiskError("Could not load risk score.");
        } else {
          try {
            const data: RiskScore = await res.json();
            setRiskScore(data);
          } catch {
            setRiskError("Could not load risk score.");
          }
        }
      } else {
        setRiskError("Could not load risk score.");
      }
      setRiskLoading(false);

      // â”€â”€ Evaluate Safety Guard after all fetches settle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (all14Logs.length > 0) {
        // last 7 UTC calendar days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6); // include today â†’ 7 days
        sevenDaysAgo.setUTCHours(0, 0, 0, 0);
        const cutoff = sevenDaysAgo.toISOString();

        const last7DaysLogs = all14Logs.filter(
          (log) => log.created_at >= cutoff
        );

        const { restrictionActive: active } = evaluateRestrictionSignal(
          last7DaysLogs,
          all14Logs
        );
        setRestrictionActive(active);
      }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-gray-900">
          Meal Spiral
        </h1>

        {/* Two-column layout on desktop, single column on mobile */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left column: Log Form */}
          <div className="space-y-6">
            <LogForm onLogSuccess={fetchAll} />
          </div>

          {/* Right column: Dashboard sections */}
          <div className="space-y-8">
            <SkipTrendChart logs={all14Logs} isLoading={logsLoading} />
            <RecentLogs
              logs={logs}
              isLoading={logsLoading}
              error={logsError}
            />
            <ClustersSection
              clusters={clusters}
              isLoading={clustersLoading}
              error={clustersError}
              restrictionActive={restrictionActive}
            />
            <RiskSection
              riskScore={riskScore}
              isLoading={riskLoading}
              error={riskError}
              restrictionActive={restrictionActive}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
