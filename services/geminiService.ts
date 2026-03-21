import { LandedCostSummary } from '../types';

function buildManualSummary(data: LandedCostSummary[]): string {
  const totalVehicles = data.length;
  const avgCost = Math.round(
    data.reduce((sum, vehicle) => sum + vehicle.total_landed_cost_usd, 0) / totalVehicles
  );
  const totalExpenses = Math.round(
    data.reduce((sum, vehicle) => sum + vehicle.total_expenses_usd, 0)
  );
  const statusBreakdown = data.reduce((acc, vehicle) => {
    acc[vehicle.status] = (acc[vehicle.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return [
    'AI fleet analytics are currently disabled in the client build.',
    `Fleet size: ${totalVehicles} vehicles`,
    `Average landed cost: $${avgCost.toLocaleString()}`,
    `Tracked expenses: $${totalExpenses.toLocaleString()}`,
    `Status mix: ${Object.entries(statusBreakdown).map(([status, count]) => `${status}: ${count}`).join(', ')}`,
    'If you want Gemini-backed insights later, move the model call behind a server endpoint rather than exposing an API key in the browser.',
  ].join('\n');
}

export const getLogisticsInsights = async (data: LandedCostSummary[]): Promise<string> => {
  if (!Array.isArray(data)) {
    return 'Unable to generate insights: invalid fleet data.';
  }

  if (data.length === 0) {
    return 'No fleet data available for analysis yet.';
  }

  return buildManualSummary(data);
};
