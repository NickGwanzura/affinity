import React, { useEffect, useState } from 'react';
import { AuditLog } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../Toast';
import ForensicLogPanel from '../shared/ForensicLogPanel';

export const ForensicsTab: React.FC = () => {
  const { showToast } = useToast();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const nextLogs = await dataService.getAuditLogs(150);
      setAuditLogs(nextLogs);
    } catch (error: any) {
      console.error('[Settings] getAuditLogs:', error);
      showToast(error?.message || 'Failed to load forensic log.', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ForensicLogPanel logs={auditLogs} loading={logsLoading} onRefresh={loadAuditLogs} />
  );
};

export default ForensicsTab;
