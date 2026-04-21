import React, { useEffect, useState } from 'react';
import { dataService } from '../services/dataService';
import { useToast } from './Toast';
import { Button, DashboardCard } from './ui';
import { Mail, Send, FileText, Users, Plus, Edit, Trash2, CheckCircle, Clock } from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
  creator_name?: string;
}

interface EmailQueueItem {
  id: string;
  to_email: string;
  to_name?: string;
  subject: string;
  body: string;
  type: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

const templateTypes = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'statement', label: 'Statement' },
  { value: 'quote', label: 'Quote' },
  { value: 'update', label: 'General Update' },
  { value: 'welcome', label: 'Welcome' },
];

export const UpdateCenter: React.FC = () => {
  const { showToast, ToastContainer } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [queue, setQueue] = useState<EmailQueueItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'templates' | 'queue' | 'send'>('templates');

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: 'update',
    subject: '',
    body: '',
  });

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    to_email: '',
    to_name: '',
    subject: '',
    body: '',
    type: 'manual',
    template_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [templateData, queueData, clientData] = await Promise.all([
        fetch('/api/emails?type=templates')
          .then(r => r.json())
          .catch(() => ({ data: [] })),
        fetch('/api/emails?type=queue')
          .then(r => r.json())
          .catch(() => ({ data: [] })),
        dataService.getClients(),
      ]);
      setTemplates(templateData.data || []);
      setQueue(queueData.data || []);
      setClients(clientData);
    } catch (error) {
      console.error('Failed to load email data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingTemplate ? 'PUT' : 'POST';
      const url = editingTemplate
        ? `/api/emails?type=templates&id=${editingTemplate.id}`
        : '/api/emails?type=templates';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm),
      });

      if (!res.ok) throw new Error('Failed to save');

      showToast(editingTemplate ? 'Template updated' : 'Template created', 'success');
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateForm({ name: '', type: 'update', subject: '', body: '' });
      fetchData();
    } catch {
      showToast('Failed to save template', 'error');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await fetch(`/api/emails?type=templates&id=${id}`, { method: 'DELETE' });
      showToast('Template deleted', 'success');
      fetchData();
    } catch {
      showToast('Failed to delete template', 'error');
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/emails?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendForm),
      });

      if (!res.ok) throw new Error('Failed to send');

      showToast('Email sent successfully', 'success');
      setShowSendModal(false);
      setSendForm({
        to_email: '',
        to_name: '',
        subject: '',
        body: '',
        type: 'manual',
        template_id: '',
      });
      fetchData();
    } catch {
      showToast('Failed to send email', 'error');
    }
  };

  const openEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      type: template.type,
      subject: template.subject,
      body: template.body,
    });
    setShowTemplateModal(true);
  };

  const openAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', type: 'update', subject: '', body: '' });
    setShowTemplateModal(true);
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSendForm({
        ...sendForm,
        template_id: templateId,
        subject: template.subject,
        body: template.body,
      });
    }
  };

  const selectClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSendForm({
        ...sendForm,
        to_email: client.email,
        to_name: client.name,
      });
    }
  };

  const stats = {
    templates: templates.length,
    sent: queue.filter(q => q.status === 'sent').length,
    pending: queue.filter(q => q.status === 'pending').length,
    failed: queue.filter(q => q.status === 'failed').length,
  };

  return (
    <div className="p-6">
      <ToastContainer />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100">
            <Mail size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Update Center</h1>
            <p className="text-sm text-gray-500">Send branded emails to clients and staff</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <DashboardCard>
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-blue-500" />
            <div>
              <div className="text-2xl font-bold">{stats.templates}</div>
              <div className="text-sm text-gray-500">Templates</div>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500" />
            <div>
              <div className="text-2xl font-bold">{stats.sent}</div>
              <div className="text-sm text-gray-500">Sent</div>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-yellow-500" />
            <div>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <div className="text-sm text-gray-500">Pending</div>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard>
          <div className="flex items-center gap-2">
            <Send size={20} className="text-purple-500" />
            <div>
              <Button size="sm" onClick={() => setShowSendModal(true)}>
                Send Email
              </Button>
            </div>
          </div>
        </DashboardCard>
      </div>

      <div className="border-b mb-4">
        <nav className="flex gap-4">
          {[
            { id: 'templates', label: 'Templates', icon: FileText },
            { id: 'queue', label: 'Email Queue', icon: Clock },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-black text-black font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'templates' && (
        <div className="mb-4 flex justify-end">
          <Button onClick={openAddTemplate} leftIcon={<Plus size={18} />}>
            New Template
          </Button>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No email templates. Create your first template.
                  </td>
                </tr>
              ) : (
                templates.map(template => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{template.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {template.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{template.subject}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                      >
                        {template.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditTemplate(template)}>
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-red-600"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No emails in queue.
                  </td>
                </tr>
              ) : (
                queue.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.to_name || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{item.to_email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.subject}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          item.status === 'sent'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {item.sent_at ? new Date(item.sent_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingTemplate ? 'Edit Template' : 'New Template'}
            </h2>
            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g. Monthly Statement"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={templateForm.type}
                  onChange={e => setTemplateForm({ ...templateForm, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {templateTypes.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={templateForm.subject}
                  onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g. Your Monthly Statement from Affinity Logistics"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Body (HTML)</label>
                <textarea
                  value={templateForm.body}
                  onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })}
                  required
                  rows={10}
                  className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                  placeholder="<html>...</html>"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingTemplate ? 'Save Changes' : 'Create Template'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Send Email</h2>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Load Template (optional)</label>
                <select
                  value={sendForm.template_id}
                  onChange={e => loadTemplate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">No template</option>
                  {templates
                    .filter(t => t.is_active)
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} - {t.subject}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Or Select Client</label>
                <select
                  value=""
                  onChange={e => selectClient(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">To Email</label>
                <input
                  type="email"
                  value={sendForm.to_email}
                  onChange={e => setSendForm({ ...sendForm, to_email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">To Name</label>
                <input
                  type="text"
                  value={sendForm.to_name}
                  onChange={e => setSendForm({ ...sendForm, to_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Client Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={sendForm.subject}
                  onChange={e => setSendForm({ ...sendForm, subject: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Body (HTML)</label>
                <textarea
                  value={sendForm.body}
                  onChange={e => setSendForm({ ...sendForm, body: e.target.value })}
                  required
                  rows={8}
                  className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowSendModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  <Send size={16} />
                  Send Email
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdateCenter;
