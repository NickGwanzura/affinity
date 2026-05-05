import React, { useEffect, useState } from 'react';
import { Asset, AssetRequest, AssetStatus, AssetRequestStatus } from '../types';
import { Button, Modal, StatCard, EmptyState, StatusBadge, SkeletonTable, defaultIcons, DashboardPageHeader, DashboardSection } from './ui';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmModal';
import { api } from '../services/apiClient';

interface AssetRegisterProps {
  userRole: 'Admin' | 'Manager' | 'Accountant';
}

export const AssetRegister: React.FC<AssetRegisterProps> = ({ userRole }) => {
  const { showToast, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [activeTab, setActiveTab] = useState<'assets' | 'requests'>('assets');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Asset form state
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetForm, setAssetForm] = useState({
    name: '', description: '', category: '', serial_number: '', status: 'Available' as AssetStatus,
    location: '', purchase_date: '', purchase_value: '', condition: 'Good'
  });

  // Request form state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<AssetRequest | null>(null);
  const [requestForm, setRequestForm] = useState({
    asset_id: '', requested_by: '', requester_email: '', requester_department: '',
    requested_take_date: '', expected_return_date: '', purpose: '', notes: ''
  });

  const isAdmin = userRole === 'Admin';
  const canEdit = userRole === 'Admin' || userRole === 'Manager';

  const notifySuccess = (message: string) => showToast(message, 'success');
  const notifyError = (message: string) => showToast(message, 'error');

  // Fetch assets
  const fetchAssets = async () => {
    try {
      const data = (await api.assets.list()) as Asset[];
      setAssets(data);
    } catch (err) {
      console.error('Error fetching assets:', err);
      notifyError('Failed to load assets');
    }
  };

  // Fetch asset requests
  const fetchRequests = async () => {
    try {
      const data = (await api.assets.requests.list()) as AssetRequest[];
      setRequests(data);
    } catch (err) {
      console.error('Error fetching requests:', err);
      notifyError('Failed to load requests');
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchAssets(), fetchRequests()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle asset form submit
  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.name || !assetForm.category) {
      notifyError('Name and category are required');
      return;
    }

    try {
      const body = {
        ...assetForm,
        purchase_value: assetForm.purchase_value ? parseFloat(assetForm.purchase_value) : null,
      };
      if (editingAsset) {
        await api.assets.update(editingAsset.id, body);
      } else {
        await api.assets.create(body);
      }

      setShowAssetModal(false);
      setEditingAsset(null);
      setAssetForm({
        name: '', description: '', category: '', serial_number: '', status: 'Available',
        location: '', purchase_date: '', purchase_value: '', condition: 'Good'
      });
      await fetchAssets();
      notifySuccess(editingAsset ? 'Asset updated' : 'Asset created');
    } catch (err: any) {
      notifyError(err.message);
    }
  };

  // Handle request form submit
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.asset_id || !requestForm.requested_by) {
      notifyError('Asset and requester name are required');
      return;
    }

    try {
      if (editingRequest) {
        await api.assets.requests.update(editingRequest.id, requestForm);
      } else {
        await api.assets.requests.create(requestForm);
      }

      setShowRequestModal(false);
      setEditingRequest(null);
      setRequestForm({
        asset_id: '', requested_by: '', requester_email: '', requester_department: '',
        requested_take_date: '', expected_return_date: '', purpose: '', notes: ''
      });
      await Promise.all([fetchAssets(), fetchRequests()]);
      notifySuccess(editingRequest ? 'Request updated' : 'Request created');
    } catch (err: any) {
      notifyError(err.message);
    }
  };

  // Handle request status update (approve, take, return)
  const handleRequestAction = async (request: AssetRequest, action: 'approve' | 'take' | 'return' | 'reject') => {
    try {
      const updates: Partial<AssetRequest> = {};
      const now = new Date().toISOString();

      switch (action) {
        case 'approve':
          updates.status = 'Approved';
          updates.approved_by = userRole;
          updates.approval_date = now;
          break;
        case 'take':
          updates.status = 'Taken';
          updates.actual_take_date = now;
          break;
        case 'return':
          updates.status = 'Returned';
          updates.actual_return_date = now;
          break;
        case 'reject':
          updates.status = 'Rejected';
          break;
      }

      await api.assets.requests.update(request.id, updates);

      await Promise.all([fetchAssets(), fetchRequests()]);
      notifySuccess(`Request ${action}d successfully`);
    } catch (err: any) {
      notifyError(err.message);
    }
  };

  // Delete asset
  const handleDeleteAsset = async (asset: Asset) => {
    const ok = await confirm({
      title: 'Delete Asset',
      message: `Are you sure you want to delete "${asset.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      isDangerous: true,
    });
    if (!ok) return;

    try {
      await api.assets.delete(asset.id);
      await fetchAssets();
      notifySuccess('Asset deleted');
    } catch (err: any) {
      notifyError(err.message);
    }
  };

  // Delete request
  const handleDeleteRequest = async (request: AssetRequest) => {
    const ok = await confirm({
      title: 'Delete Request',
      message: 'Are you sure you want to delete this request?',
      confirmLabel: 'Delete',
      isDangerous: true,
    });
    if (!ok) return;

    try {
      await api.assets.requests.delete(request.id);
      await Promise.all([fetchAssets(), fetchRequests()]);
      notifySuccess('Request deleted');
    } catch (err: any) {
      notifyError(err.message);
    }
  };

  // Edit asset
  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      description: asset.description || '',
      category: asset.category,
      serial_number: asset.serial_number || '',
      status: asset.status,
      location: asset.location || '',
      purchase_date: asset.purchase_date || '',
      purchase_value: asset.purchase_value?.toString() || '',
      condition: asset.condition,
    });
    setShowAssetModal(true);
  };

  // Edit request
  const handleEditRequest = (request: AssetRequest) => {
    setEditingRequest(request);
    setRequestForm({
      asset_id: request.asset_id,
      requested_by: request.requested_by,
      requester_email: request.requester_email || '',
      requester_department: request.requester_department || '',
      requested_take_date: request.requested_take_date || '',
      expected_return_date: request.expected_return_date || '',
      purpose: request.purpose || '',
      notes: request.notes || '',
    });
    setShowRequestModal(true);
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-800';
      case 'Borrowed': return 'bg-[#D97706]/10 text-[#D97706]';
      case 'Under Maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'Retired': return 'bg-gray-100 text-gray-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-[#D97706]/10 text-[#D97706]';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Taken': return 'bg-stone-200 text-stone-800';
      case 'Returned': return 'bg-green-100 text-green-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Stats
  const totalAssets = assets.length;
  const availableAssets = assets.filter(a => a.status === 'Available').length;
  const borrowedAssets = assets.filter(a => a.status === 'Borrowed').length;
  const pendingRequests = requests.filter(r => r.status === 'Pending').length;
  const activeTabLabel = activeTab === 'assets' ? 'Assets' : 'Requests';

  if (loading) {
    return (
      <div className="p-6">
        <SkeletonTable columns={5} rows={5} />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <ToastContainer />
      <ConfirmDialog />

      {/* Header */}
      <DashboardPageHeader
        title="Asset Register"
        subtitle="Fleet vehicles, equipment, and their valuations"
        actions={
          canEdit ? (
            <Button onClick={() => { setEditingAsset(null); setShowAssetModal(true); }}>
              + Add Asset
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total" value={totalAssets.toString()} />
        <StatCard title="Available" value={availableAssets.toString()} className="bg-green-50" />
        <StatCard title="Borrowed" value={borrowedAssets.toString()} className="bg-stone-50" />
        <StatCard title="Pending" value={pendingRequests.toString()} className="bg-yellow-50" />
      </div>

      <div className="sm:hidden">
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-gray-500">View</label>
        <select
          value={activeTab}
          onChange={(event) => setActiveTab(event.target.value as 'assets' | 'requests')}
          className="w-full border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20"
          aria-label="Select asset register section"
        >
          <option value="assets">Assets</option>
          <option value="requests">Requests</option>
        </select>
        <p className="mt-2 text-sm text-gray-500">Currently viewing {activeTabLabel.toLowerCase()}.</p>
      </div>

      {/* Tabs - desktop */}
      <div className="border-b border-gray-200 -mx-3 px-3 sm:mx-0 sm:px-0">
        <nav className="-mb-px hidden sm:flex space-x-4 sm:space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('assets')}
            className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'assets'
                ? 'border-[#D97706] text-[#D97706]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Assets
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'requests'
                ? 'border-[#D97706] text-[#D97706]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Requests
          </button>
        </nav>
      </div>

      {/* Assets Tab */}
      {activeTab === 'assets' && (
        <DashboardSection title="Assets">
        <div className="space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={() => { setEditingAsset(null); setShowAssetModal(true); }}>
                + Add Asset
              </Button>
            </div>
          )}

          {assets.length === 0 ? (
            <EmptyState
              title="No assets"
              description="Start by adding your first asset to the register"
              icon={defaultIcons.folder}
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {assets.map((asset) => (
                  <div key={asset.id} className=" border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-gray-900">{asset.name}</p>
                        <p className="mt-1 text-sm text-gray-500">{asset.category}</p>
                        {asset.description && <p className="mt-2 text-sm text-gray-600">{asset.description}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(asset.status)}`}>
                        {asset.status}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-600">
                      <p><span className="font-semibold text-gray-900">Serial:</span> {asset.serial_number || '-'}</p>
                      <p><span className="font-semibold text-gray-900">Location:</span> {asset.location || '-'}</p>
                      <p><span className="font-semibold text-gray-900">Condition:</span> {asset.condition}</p>
                    </div>
                    {canEdit && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => handleEditAsset(asset)}>
                          Edit
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="danger" onClick={() => handleDeleteAsset(asset)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                    {canEdit && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{asset.name}</div>
                        {asset.description && <div className="text-sm text-gray-500">{asset.description}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{asset.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{asset.serial_number || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(asset.status)}`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{asset.location || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{asset.condition}</td>
                      {canEdit && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => handleEditAsset(asset)}
                            className="text-[#D97706] hover:text-[#B45309] mr-3"
                          >
                            Edit
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteAsset(asset)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
        </DashboardSection>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <DashboardSection title="Requests">
        <div className="space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={() => { setEditingRequest(null); setShowRequestModal(true); }}>
                + New Request
              </Button>
            </div>
          )}

          {requests.length === 0 ? (
            <EmptyState
              title="No requests"
              description="There are no asset borrowing requests yet"
              icon={defaultIcons.folder}
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {requests.map((request) => (
                  <div key={request.id} className=" border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-gray-900">{request.asset_name || 'Unknown'}</p>
                        <p className="mt-1 text-sm text-gray-500">{request.asset_category || 'Asset request'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-gray-600">
                      <p><span className="font-semibold text-gray-900">Requested by:</span> {request.requested_by}</p>
                      <p><span className="font-semibold text-gray-900">Department:</span> {request.requester_department || '-'}</p>
                      <p><span className="font-semibold text-gray-900">Request date:</span> {request.request_date ? new Date(request.request_date).toLocaleDateString() : '-'}</p>
                      <p><span className="font-semibold text-gray-900">Take date:</span> {request.requested_take_date || '-'}</p>
                      <p><span className="font-semibold text-gray-900">Return date:</span> {request.expected_return_date || '-'}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {canEdit && request.status === 'Pending' && (
                        <>
                          <Button size="sm" onClick={() => handleRequestAction(request, 'approve')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleRequestAction(request, 'reject')}>
                            Reject
                          </Button>
                        </>
                      )}
                      {canEdit && request.status === 'Approved' && (
                        <Button size="sm" onClick={() => handleRequestAction(request, 'take')}>
                          Mark Taken
                        </Button>
                      )}
                      {canEdit && request.status === 'Taken' && (
                        <Button size="sm" onClick={() => handleRequestAction(request, 'return')}>
                          Mark Returned
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => handleEditRequest(request)}>
                        Edit
                      </Button>
                      {isAdmin && (
                        <Button size="sm" variant="danger" onClick={() => handleDeleteRequest(request)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Take Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{request.asset_name || 'Unknown'}</div>
                        {request.asset_category && <div className="text-sm text-gray-500">{request.asset_category}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900">{request.requested_by}</div>
                        {request.requester_email && <div className="text-sm text-gray-500">{request.requester_email}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{request.requester_department || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {request.request_date ? new Date(request.request_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {request.requested_take_date || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {request.expected_return_date || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                        {canEdit && request.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleRequestAction(request, 'approve')}
                              className="text-green-600 hover:text-green-900"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRequestAction(request, 'reject')}
                              className="text-red-600 hover:text-red-900"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {canEdit && request.status === 'Approved' && (
                          <button
                            onClick={() => handleRequestAction(request, 'take')}
                            className="text-[#D97706] hover:text-[#B45309]"
                          >
                            Mark Taken
                          </button>
                        )}
                        {canEdit && request.status === 'Taken' && (
                          <button
                            onClick={() => handleRequestAction(request, 'return')}
                            className="text-stone-700 hover:text-stone-900"
                          >
                            Mark Returned
                          </button>
                        )}
                        <button
                          onClick={() => handleEditRequest(request)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteRequest(request)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
        </DashboardSection>
      )}

      {/* Asset Modal */}
      <Modal
        isOpen={showAssetModal}
        onClose={() => { setShowAssetModal(false); setEditingAsset(null); }}
        title={editingAsset ? 'Edit Asset' : 'Add Asset'}
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => { setShowAssetModal(false); setEditingAsset(null); }}>
              Cancel
            </Button>
            <Button type="submit" form="asset-form">
              {editingAsset ? 'Save' : 'Create'}
            </Button>
          </div>
        }
      >
        <form id="asset-form" onSubmit={handleAssetSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Name *</label>
            <input
              type="text"
              value={assetForm.name}
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              className="mt-1 block w-full border border-gray-300 px-3 py-3 sm:py-2 text-sm sm:text-base focus:border-[#D97706] focus:ring-[#D97706]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Category *</label>
            <select
              value={assetForm.category}
              onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
              className="mt-1 block w-full border border-gray-300 px-3 py-3 sm:py-2 text-sm sm:text-base focus:border-[#D97706] focus:ring-[#D97706]"
              required
            >
              <option value="">Select…</option>
              <option value="Electronics">Electronics</option>
              <option value="Equipment">Equipment</option>
              <option value="Tools">Tools</option>
              <option value="Office Equipment">Office Equipment</option>
              <option value="Furniture">Furniture</option>
              <option value="Vehicles">Vehicles</option>
              <option value="Safety">Safety</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Description</label>
            <textarea
              value={assetForm.description}
              onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
              className="mt-1 block w-full border border-gray-300 px-3 py-3 sm:py-2 text-sm sm:text-base focus:border-[#D97706] focus:ring-[#D97706]"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Serial #</label>
            <input
              type="text"
              value={assetForm.serial_number}
              onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
              className="mt-1 block w-full border border-gray-300 px-3 py-3 sm:py-2 text-sm sm:text-base focus:border-[#D97706] focus:ring-[#D97706]"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700">Status</label>
              <select
                value={assetForm.status}
                onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value as AssetStatus })}
                className="mt-1 block w-full border border-gray-300 px-3 py-3 sm:py-2 text-sm sm:text-base focus:border-[#D97706] focus:ring-[#D97706]"
              >
                <option value="Available">Available</option>
                <option value="Borrowed">Borrowed</option>
                <option value="Under Maintenance">Maintenance</option>
                <option value="Retired">Retired</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Condition</label>
              <select
                value={assetForm.condition}
                onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })}
                className="mt-1 block w-full border border-gray-300 px-3 py-3 sm:py-2 text-sm sm:text-base focus:border-[#D97706] focus:ring-[#D97706]"
              >
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Location</label>
            <input
              type="text"
              value={assetForm.location}
              onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
              className="mt-1 block w-full border border-gray-300 px-3 py-3 sm:py-2 text-sm sm:text-base focus:border-[#D97706] focus:ring-[#D97706]"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Purchase Date</label>
              <input
                type="date"
                value={assetForm.purchase_date}
                onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 px-3 py-2 focus:border-[#D97706] focus:ring-[#D97706]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Value (USD)</label>
              <input
                type="number"
                step="0.01"
                value={assetForm.purchase_value}
                onChange={(e) => setAssetForm({ ...assetForm, purchase_value: e.target.value })}
                className="mt-1 block w-full border border-gray-300 px-3 py-2 focus:border-[#D97706] focus:ring-[#D97706]"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Request Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => { setShowRequestModal(false); setEditingRequest(null); }}
        title={editingRequest ? 'Edit Request' : 'New Request'}
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => { setShowRequestModal(false); setEditingRequest(null); }}>
              Cancel
            </Button>
            <Button type="submit" form="request-form">
              {editingRequest ? 'Update' : 'Create'} Request
            </Button>
          </div>
        }
      >
        <form id="request-form" onSubmit={handleRequestSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Asset *</label>
            <select
              value={requestForm.asset_id}
              onChange={(e) => setRequestForm({ ...requestForm, asset_id: e.target.value })}
              className="mt-1 block w-full border border-gray-300 px-3 py-3 sm:py-2 text-sm sm:text-base focus:border-[#D97706] focus:ring-[#D97706]"
              required
              disabled={!!editingRequest}
            >
              <option value="">Select asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id} disabled={asset.status !== 'Available'}>
                  {asset.name} ({asset.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Requested By *</label>
            <input
              type="text"
              value={requestForm.requested_by}
              onChange={(e) => setRequestForm({ ...requestForm, requested_by: e.target.value })}
              className="mt-1 block w-full border border-gray-300 px-3 py-3 sm:py-2 text-sm sm:text-base focus:border-[#D97706] focus:ring-[#D97706]"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700">Email</label>
              <input
                type="email"
                value={requestForm.requester_email}
                onChange={(e) => setRequestForm({ ...requestForm, requester_email: e.target.value })}
                className="mt-1 block w-full border border-gray-300 px-3 py-3 sm:py-2 text-sm sm:text-base focus:border-[#D97706] focus:ring-[#D97706]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Department</label>
              <input
                type="text"
                value={requestForm.requester_department}
                onChange={(e) => setRequestForm({ ...requestForm, requester_department: e.target.value })}
                className="mt-1 block w-full border border-gray-300 px-3 py-2 focus:border-[#D97706] focus:ring-[#D97706]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Requested Take Date</label>
              <input
                type="date"
                value={requestForm.requested_take_date}
                onChange={(e) => setRequestForm({ ...requestForm, requested_take_date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 px-3 py-2 focus:border-[#D97706] focus:ring-[#D97706]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Expected Return Date</label>
              <input
                type="date"
                value={requestForm.expected_return_date}
                onChange={(e) => setRequestForm({ ...requestForm, expected_return_date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 px-3 py-2 focus:border-[#D97706] focus:ring-[#D97706]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Purpose</label>
            <textarea
              value={requestForm.purpose}
              onChange={(e) => setRequestForm({ ...requestForm, purpose: e.target.value })}
              className="mt-1 block w-full border border-gray-300 px-3 py-2 focus:border-[#D97706] focus:ring-[#D97706]"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={requestForm.notes}
              onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
              className="mt-1 block w-full border border-gray-300 px-3 py-2 focus:border-[#D97706] focus:ring-[#D97706]"
              rows={2}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
