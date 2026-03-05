"use client";

import { Lock, CheckCircle } from "lucide-react";

type ComingSoonCardProps = {
  title: string;
  description: string;
  benefits: string[];
  onNotifyMe?: () => void;
  onLearnMore?: () => void;
};

export default function ComingSoonCard({
  title,
  description,
  benefits,
}: ComingSoonCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6">
      {/* Lock badge */}
      <div className="absolute right-4 top-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
          <Lock className="h-5 w-5 text-amber-600" />
        </div>
      </div>

      {/* Coming Soon badge */}
      <div className="mb-4 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
        Coming Soon
      </div>

      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mb-4 text-sm text-gray-600">{description}</p>

      {/* Benefits */}
      <ul className="mb-6 space-y-2">
        {benefits.map((benefit, i) => (
          <li key={i} className="flex items-start text-sm text-gray-600">
            <CheckCircle className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            {benefit}
          </li>
        ))}
      </ul>

      {/* CTAs */}
      <div className="flex gap-3">
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors">
          Notify Me When Ready
        </button>
        <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          Learn More
        </button>
      </div>
    </div>
  );
}
