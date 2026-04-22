import React, { useCallback, useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { Button, Loading } from './ui';
import { dataService } from '../services/dataService';
import { useToast } from './Toast';
import { useConfirm } from './shared/CarbonConfirmModal';
import {
  ClientListSidebar,
  ClientDetailPanel,
  ClientFormModalWithBalance,
  buildEnrichedClients,
  computeClientStats,
  downloadClientStatementPdf,
  useClientDirectoryData,
  useClientCrud,
  type EnrichedClient,
} from './client-directory';

export const ClientDirectory: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const notifyError = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
  const data = useClientDirectoryData(notifyError);

  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<EnrichedClient | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const crud = useClientCrud({
    onSuccess: data.reload,
    showToast,
    confirm,
    onDeleteSelected: (id) => {
      if (selectedClient?.id === id) setSelectedClient(null);
    },
  });

  const enrichedClients = useMemo(
    () => buildEnrichedClients(data.clients, data.invoices),
    [data.clients, data.invoices]
  );

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrichedClients;
    return enrichedClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
    );
  }, [enrichedClients, search]);

  const statsFor = (name: string) =>
    computeClientStats(name, enrichedClients, data.invoices, data.quotes, data.payments);

  const handleDownloadPdf = async () => {
    if (!selectedClient) return;
    setIsGeneratingPdf(true);
    try {
      const company = await dataService.getCompanyDetails();
      if (!company) return showToast('Company details not found', 'error');
      await downloadClientStatementPdf(
        selectedClient,
        data.invoices,
        data.payments,
        company,
        dateFrom,
        dateTo
      );
      showToast('Statement downloaded successfully', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate statement', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (data.loading) return <Loading description="Loading clients…" withOverlay={false} />;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <ToastContainer />
      <ConfirmDialog />

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Client Directory</h1>
            <p className="text-sm text-gray-500">
              {enrichedClients.length} clients · financials, vehicles &amp; shipments
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus size={14} />} onClick={crud.openAdd}>Add Client</Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <ClientListSidebar
          clients={filteredClients}
          selectedClientId={selectedClient?.id ?? null}
          search={search}
          onSearchChange={setSearch}
          onSelect={(c) => { setSelectedClient(c); setActiveTab(0); }}
          getStats={statsFor}
          hidden={Boolean(selectedClient)}
        />
        <div className={`flex-1 min-w-0 ${!selectedClient ? 'hidden lg:block' : ''}`}>
          <ClientDetailPanel
            client={selectedClient}
            enrichedClients={enrichedClients}
            invoices={data.invoices}
            quotes={data.quotes}
            payments={data.payments}
            vehicles={data.vehicles}
            shipments={data.shipments}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            onBack={() => setSelectedClient(null)}
            onEdit={crud.openEdit}
            onDelete={crud.handleDelete}
            onRefresh={data.reload}
            showToast={showToast}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onDownloadPdf={handleDownloadPdf}
            isGeneratingPdf={isGeneratingPdf}
          />
        </div>
      </div>

      <ClientFormModalWithBalance
        isOpen={crud.isOpen}
        title={crud.editing ? 'Edit Client' : 'Add New Client'}
        onClose={crud.close}
        onSubmit={crud.handleSave}
        form={crud.form}
        onChange={crud.setFormField}
        submitLabel={crud.editing ? 'Save Changes' : 'Create Client'}
        isSubmitting={crud.isSubmitting}
      />
    </div>
  );
};

export default ClientDirectory;
