export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return "\u2014";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(dateString: string): string {
  if (!dateString) return "\u2014";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return "\u2014";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    fail: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };
  return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    A: "bg-green-500",
    B: "bg-green-400",
    C: "bg-yellow-400",
    D: "bg-orange-400",
    E: "bg-red-500",
  };
  return colors[grade] || "bg-gray-400";
}

export function getGradeTextColor(grade: string): string {
  const colors: Record<string, string> = {
    A: "text-green-500",
    B: "text-green-400",
    C: "text-yellow-400",
    D: "text-orange-400",
    E: "text-red-500",
  };
  return colors[grade] || "text-gray-400";
}

export function getKpiStatusBorder(status: string): string {
  const borders: Record<string, string> = {
    good: "border-b-4 border-green-500",
    warning: "border-b-4 border-yellow-500",
    danger: "border-b-4 border-red-500",
  };
  return borders[status] || "border-b-4 border-gray-300";
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    medium: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    low: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    warning: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    convention: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    refactor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  };
  return colors[severity.toLowerCase()] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
}
