import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { SparklinePoint } from "@/lib/api";

export function Sparkline({ data }: { data: SparklinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-primary)"
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
