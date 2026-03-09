import { useCallback, useMemo } from 'react';
import { Vehicle, Expense, LandedCostSummary } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useAsync } from './useAsync';
import { useToast } from '../components/Toast';

interface VehicleData {
  vehicles: Vehicle[];
  expenses: Expense[];
  summaries: LandedCostSummary[];
}

export interface UseVehicleDataReturn {
  vehicles: Vehicle[];
  expenses: Expense[];
  summaries: LandedCostSummary[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'created_at'>) => Promise<void>;
  updateVehicle: (id: string, vehicle: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'created_at'>) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

export function useVehicleData(): UseVehicleDataReturn {
  const { showToast } = useToast();

  // Fetch all vehicle data (vehicles, expenses, summaries)
  const fetchVehicleData = useCallback(async (): Promise<VehicleData> => {
    const [vehicles, expenses, summaries] = await Promise.all([
      supabaseService.getVehicles(),
      supabaseService.getExpenses(),
      supabaseService.getLandedCostSummaries(),
    ]);

    return { vehicles, expenses, summaries };
  }, []);

  // Use useAsync for data fetching with immediate execution
  const {
    data,
    loading,
    error,
    execute,
    setData,
  } = useAsync<VehicleData>(fetchVehicleData, true);

  // Refresh function to reload all data
  const refresh = useCallback(async (): Promise<void> => {
    await execute();
  }, [execute]);

  // Add a new vehicle
  const addVehicle = useCallback(
    async (vehicle: Omit<Vehicle, 'id' | 'created_at'>): Promise<void> => {
      try {
        const newVehicle = await supabaseService.addVehicle(vehicle);
        
        // Optimistically update local state
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            vehicles: [...prev.vehicles, newVehicle],
          };
        });

        showToast('Vehicle added successfully', 'success');
        
        // Refresh to get updated summaries
        await refresh();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add vehicle';
        showToast(errorMessage, 'error');
        throw err;
      }
    },
    [setData, showToast, refresh]
  );

  // Update an existing vehicle
  const updateVehicle = useCallback(
    async (id: string, vehicle: Partial<Vehicle>): Promise<void> => {
      try {
        const updatedVehicle = await supabaseService.updateVehicle(id, vehicle);

        // Optimistically update local state
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            vehicles: prev.vehicles.map((v) =>
              v.id === id ? updatedVehicle : v
            ),
          };
        });

        showToast('Vehicle updated successfully', 'success');
        
        // Refresh to get updated summaries
        await refresh();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update vehicle';
        showToast(errorMessage, 'error');
        throw err;
      }
    },
    [setData, showToast, refresh]
  );

  // Delete a vehicle
  const deleteVehicle = useCallback(
    async (id: string): Promise<void> => {
      try {
        await supabaseService.deleteVehicle(id);

        // Optimistically update local state
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            vehicles: prev.vehicles.filter((v) => v.id !== id),
            expenses: prev.expenses.filter((e) => e.vehicle_id !== id),
            summaries: prev.summaries.filter((s) => s.vehicle_id !== id),
          };
        });

        showToast('Vehicle deleted successfully', 'success');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete vehicle';
        showToast(errorMessage, 'error');
        throw err;
      }
    },
    [setData, showToast]
  );

  // Add a new expense
  const addExpense = useCallback(
    async (expense: Omit<Expense, 'id' | 'created_at'>): Promise<void> => {
      try {
        // Note: supabaseService.addExpense expects a slightly different type
        // It doesn't require exchange_rate_to_usd as it's calculated server-side
        const { exchange_rate_to_usd, ...expenseData } = expense as any;
        const newExpense = await supabaseService.addExpense(expenseData);

        // Optimistically update local state
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            expenses: [...prev.expenses, newExpense],
          };
        });

        showToast('Expense added successfully', 'success');
        
        // Refresh to get updated summaries
        await refresh();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add expense';
        showToast(errorMessage, 'error');
        throw err;
      }
    },
    [setData, showToast, refresh]
  );

  // Update an existing expense
  const updateExpense = useCallback(
    async (id: string, expense: Partial<Expense>): Promise<void> => {
      try {
        const { exchange_rate_to_usd, ...expenseData } = expense as any;
        const updatedExpense = await supabaseService.updateExpense(id, expenseData);

        // Optimistically update local state
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            expenses: prev.expenses.map((e) =>
              e.id === id ? updatedExpense : e
            ),
          };
        });

        showToast('Expense updated successfully', 'success');
        
        // Refresh to get updated summaries
        await refresh();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update expense';
        showToast(errorMessage, 'error');
        throw err;
      }
    },
    [setData, showToast, refresh]
  );

  // Delete an expense
  const deleteExpense = useCallback(
    async (id: string): Promise<void> => {
      try {
        await supabaseService.deleteExpense(id);

        // Optimistically update local state
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            expenses: prev.expenses.filter((e) => e.id !== id),
          };
        });

        showToast('Expense deleted successfully', 'success');
        
        // Refresh to get updated summaries
        await refresh();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete expense';
        showToast(errorMessage, 'error');
        throw err;
      }
    },
    [setData, showToast, refresh]
  );

  // Memoize the returned data to prevent unnecessary re-renders
  const vehicles = useMemo(() => data?.vehicles ?? [], [data?.vehicles]);
  const expenses = useMemo(() => data?.expenses ?? [], [data?.expenses]);
  const summaries = useMemo(() => data?.summaries ?? [], [data?.summaries]);

  return {
    vehicles,
    expenses,
    summaries,
    loading,
    error,
    refresh,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addExpense,
    updateExpense,
    deleteExpense,
  };
}
