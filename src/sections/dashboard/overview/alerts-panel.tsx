"use client";

import Link from "next/link";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Lock,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";
import type { AlertItem } from "./types";

const SEVERITY_ICON: Record<string, React.ElementType> = {
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
};

const SEVERITY_STYLES: Record<string, string> = {
  warning: "text-amber-600 bg-amber-50",
  error: "text-red-600 bg-red-50",
  info: "text-blue-600 bg-blue-50",
};

type AlertsPanelProps = {
  alerts: AlertItem[];
};

export default function AlertsPanel({ alerts }: AlertsPanelProps) {
  const activeAlerts = alerts.filter((a) => !a.comingSoon);
  const comingSoonAlerts = alerts.filter((a) => a.comingSoon);

  return (
    <div className="mb-8 rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          Needs Attention
        </h2>
        {activeAlerts.length > 0 && (
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">
            {activeAlerts.length}
          </span>
        )}
      </div>

      {/* Empty state */}
      {activeAlerts.length === 0 && comingSoonAlerts.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">
            All clear! Your listings are in great shape.
          </p>
        </div>
      )}

      {/* Active alerts */}
      <div className="space-y-2">
        {activeAlerts.map((alert) => {
          const SeverityIcon = SEVERITY_ICON[alert.severity] ?? Info;

          return (
            <div
              key={alert.id}
              className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={clsx(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    SEVERITY_STYLES[alert.severity]
                  )}
                >
                  <SeverityIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {alert.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {alert.description}
                  </p>
                </div>
              </div>
              <Link
                href={alert.actionHref}
                className="shrink-0 flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
              >
                {alert.actionLabel}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          );
        })}

        {/* Coming Soon alerts */}
        {comingSoonAlerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between gap-4 rounded-xl bg-gray-50/60 px-4 py-3 opacity-60"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-500">
                <Lock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-600 truncate">
                  {alert.title}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {alert.description}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-800">
              Coming Soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
