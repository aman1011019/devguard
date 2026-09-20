import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileCode2,
  GitBranch,
  Radio,
  ScrollText,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface EvidenceItem {
  id: string;
  category: "LOG" | "CODE" | "DEPLOYMENT" | "TELEMETRY" | "AUTHOR";
  title: string;
  icon: typeof ScrollText;
  badgeTone: "bad" | "brand" | "warn" | "ok" | "neutral";
  preview: string;
  details: {
    label: string;
    value: string;
  }[];
  rawContent?: string;
}

const CHAIN_ITEMS: EvidenceItem[] = [
  {
    id: "log",
    category: "LOG",
    title: "Checkout request exceeded timeout threshold.",
    icon: ScrollText,
    badgeTone: "bad",
    preview: "3000ms timeout exceeded on POST /checkout — 25 queries issued in sequential loop.",
    details: [
      { label: "Level", value: "ERROR" },
      { label: "Pattern", value: "Database query timeout after 3000ms" },
      { label: "Target", value: "SELECT * FROM products WHERE id = ?" },
      { label: "Count", value: "37 timeout events recorded in trailing 60s" },
    ],
    rawContent: `ERROR 14:35:22.412 [http-nio-8080-exec-4] c.d.c.OrderService: Database query timeout after 3000ms
Context: order=9182 query_index=18/25 pool=46/50 elapsed=4812ms
HTTP 500 returned for POST /checkout order=9182 (error rate: 21.8%)`,
  },
  {
    id: "code",
    category: "CODE",
    title: "OrderService.java:184",
    icon: FileCode2,
    badgeTone: "brand",
    preview: "Sequential per-item query loop introduced inside loadOrderWithProducts method.",
    details: [
      { label: "File", value: "src/main/java/com/devguard/checkout/OrderService.java" },
      { label: "Line", value: "184" },
      { label: "Anti-pattern", value: "N+1 Database Query" },
      { label: "Method", value: "loadOrderWithProducts(Long orderId)" },
    ],
    rawContent: `// OrderService.java:184 (Commit 8f41c2a)
for (OrderItem item : order.getItems()) {
    // N+1: one SELECT is issued per order item on every checkout request
    Product product = productRepository.fetchProduct(item.getProductId());
    itemViews.add(OrderItemView.of(item, product));
}`,
  },
  {
    id: "deployment",
    category: "DEPLOYMENT",
    title: "v1.8.4",
    icon: GitBranch,
    badgeTone: "warn",
    preview: "Release v1.8.4 deployed 6 minutes prior to incident onset across 12 pods.",
    details: [
      { label: "Version", value: "v1.8.4" },
      { label: "Commit SHA", value: "8f41c2a" },
      { label: "Deployed At", value: "14:31 UTC" },
      { label: "Description", value: "checkout optimization (enrich order items with product data)" },
    ],
    rawContent: `Deployment: checkout-service:v1.8.4
Status: 12/12 pods healthy at rollout
Trigger: git push origin release/v1.8.4 by j.tanaka
Onset latency delta: +2300% within 90 seconds of traffic shift`,
  },
  {
    id: "telemetry",
    category: "TELEMETRY",
    title: "DB queries: 3 → 25/request",
    icon: Radio,
    badgeTone: "bad",
    preview: "Query volume rose +840%, DB latency jumped 40ms → 3.9s (+620%).",
    details: [
      { label: "Baseline Queries", value: "3 queries / request" },
      { label: "Incident Queries", value: "25 queries / request (+840%)" },
      { label: "DB Latency", value: "40ms → 3900ms" },
      { label: "P95 API Latency", value: "200ms → 4800ms" },
    ],
    rawContent: `Prometheus metric: checkout.db.queries_per_request
Before rollout: 3.00 avg (pool saturation 14%)
Post rollout:   25.00 avg (pool saturation 92%, thread starvation detected)
Correlation coefficient with v1.8.4 rollout: 0.992`,
  },
  {
    id: "author",
    category: "AUTHOR",
    title: "j.tanaka",
    icon: UserCheck,
    badgeTone: "neutral",
    preview: "Author of commit 8f41c2a implementing line item product enrichment.",
    details: [
      { label: "Author", value: "j.tanaka" },
      { label: "Team", value: "Checkout Core" },
      { label: "Commit", value: "8f41c2a" },
      { label: "Reviewers", value: "Automated PR merge #412" },
    ],
    rawContent: `commit 8f41c2a7e2b109e9f6c7a102
Author: j.tanaka <j.tanaka@devguard.internal>
Date:   Today 14:28:10
Subject: checkout optimization: enrich order items with product data in OrderService`,
  },
];

export function EvidenceChain() {
  const [expandedId, setExpandedId] = useState<string | null>("code");

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-faint font-mono">
          EVIDENCE CHAIN
        </h4>
        <span className="text-2xs text-muted">Click any evidence card to inspect proof</span>
      </div>

      <div className="grid gap-2.5">
        {CHAIN_ITEMS.map((item) => {
          const Icon = item.icon;
          const isExpanded = expandedId === item.id;

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-2xl border transition-all duration-200 overflow-hidden",
                isExpanded
                  ? "border-brand/50 bg-surface shadow-md"
                  : "border-line bg-elevated/40 hover:border-strong"
              )}
            >
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={isExpanded}
                className="flex w-full items-start justify-between gap-3 p-3.5 text-left"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-xl border",
                      isExpanded
                        ? "border-brand/40 bg-brand/12 text-brand"
                        : "border-line bg-surface text-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={item.badgeTone}>{item.category}</Badge>
                      <span className="truncate text-sm font-bold text-ink">
                        {item.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-1">
                      {item.preview}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 p-1 text-muted">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-line/60 bg-surface/90 p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {item.details.map((d) => (
                      <div
                        key={d.label}
                        className="rounded-xl border border-line/60 bg-elevated/50 p-2.5"
                      >
                        <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-faint block">
                          {d.label}
                        </span>
                        <span className="mt-0.5 text-xs font-medium text-ink font-mono block truncate">
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {item.rawContent && (
                    <div>
                      <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-faint block mb-1">
                        Raw Evidence Payload
                      </span>
                      <pre className="overflow-x-auto rounded-xl bg-canvas/80 p-3 font-mono text-2xs leading-relaxed text-muted border border-line/60">
                        {item.rawContent}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
