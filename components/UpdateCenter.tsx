import React, { useEffect, useState } from 'react';
import { dataService } from '../services/dataService';
import { api } from '../services/apiClient';
import { useToast } from './Toast';
import { Button, DashboardKpiCard, DashboardPageHeader, DashboardSection, Modal, TextInput, Select, SelectItem, TextArea } from './ui';
import { Send, FileText, Plus, Edit, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'templates' | 'queue'>('templates');

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
        api.request<{ data: EmailTemplate[] }>('/emails?type=templates').catch(() => ({ data: [] })),
        api.request<{ data: EmailQueueItem[] }>('/emails?type=queue').catch(() => ({ data: [] })),
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
      const endpoint = editingTemplate
        ? `/emails?type=templates&id=${editingTemplate.id}`
        : '/emails?type=templates';

      await api.request(endpoint, {
        method: editingTemplate ? 'PUT' : 'POST',
        body: JSON.stringify(templateForm),
      });

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
      await api.request(`/emails?type=templates&id=${id}`, { method: 'DELETE' });
      showToast('Template deleted', 'success');
      fetchData();
    } catch {
      showToast('Failed to delete template', 'error');
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.request('/emails?action=send', {
        method: 'POST',
        body: JSON.stringify(sendForm),
      });

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
    <div className="space-y-6">
      <ToastContainer />

      <DashboardPageHeader
        title="Update Center"
        subtitle="Email templates and send queue"
        actions={
          <Button onClick={() => setShowSendModal(true)} leftIcon={<Send size={18} />}>
            Send Email
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DashboardKpiCard label="Templates" value={stats.templates} icon={FileText} iconTone="amber" />
        <DashboardKpiCard label="Sent" value={stats.sent} icon={CheckCircle} iconTone="emerald" />
        <DashboardKpiCard label="Pending" value={stats.pending} icon={Clock} iconTone="blue" />
        <DashboardKpiCard label="Failed" value={stats.failed} icon={AlertCircle} iconTone="rose" />
      </div>

      <DashboardSection title={activeTab === 'queue' ? 'Email Queue' : 'Templates'}>
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
                  ? 'border-[#D97706] text-[#D97706] font-semibold'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
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
        <div className="bg-white border overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No email templates. Create your first template.
                  </td>
                </tr>
              ) : (
                templates.map(template => (
                  <tr key={template.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium">{template.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-stone-100 text-stone-700 text-xs">
                        {template.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{template.subject}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-800'}`}
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
        <div className="bg-white border overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No emails in queue.
                  </td>
                </tr>
              ) : (
                queue.map(item => (
                  <tr key={item.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.to_name || 'N/A'}</div>
                      <div className="text-sm text-zinc-500">{item.to_email}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{item.subject}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-zinc-100 text-zinc-800 rounded text-xs">
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
                    <td className="px-4 py-3 text-zinc-600 text-sm">
                      {item.sent_at ? new Date(item.sent_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      </DashboardSection>

      <Modal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title={editingTemplate ? 'Edit Template' : 'New Template'}
        label="Email template"
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" type="button" onClick={() => setShowTemplateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="template-form">
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        }
      >
        <form id="template-form" onSubmit={handleSaveTemplate} className="space-y-4">
          {/* Template Info */}
          <section>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Template Info</h3>
              <div className="space-y-3">
              <TextInput
                id="template-name"
                labelText="Template Name"
                placeholder="e.g. Monthly Statement"
                value={templateForm.name}
                onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                required
              />
              <Select
                id="template-type"
                labelText="Type"
                value={templateForm.type}
                onChange={e => setTemplateForm({ ...templateForm, type: e.target.value })}
              >
                {templateTypes.map(t => (
                  <SelectItem key={t.value} value={t.value} text={t.label} />
                ))}
              </Select>
            </div>
          </div>
        </section>

          {/* Content */}
          <section>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Content</h3>
              <div className="space-y-3">
              <TextInput
                id="template-subject"
                labelText="Subject"
                placeholder="e.g. Your Monthly Statement from Affinity Logistics"
                value={templateForm.subject}
                onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })}
                required
              />
              <TextArea
                id="template-body"
                labelText="Body (HTML)"
                placeholder="<html>...</html>"
                rows={10}
                value={templateForm.body}
                onChange={e => setTemplateForm({ ...templateForm, body: e.target.value })}
                required
              />
            </div>
          </div>
        </section>
        </form>
      </Modal>

      <Modal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        title="Send Email"
        label="Compose message"
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" type="button" onClick={() => setShowSendModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="send-email-form" leftIcon={<Send size={16} />}>
              Send Email
            </Button>
          </div>
        }
      >
        <form id="send-email-form" onSubmit={handleSendEmail} className="space-y-4">
          {/* Quick Select */}
          <section>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Quick Select</h3>
              <div className="space-y-3">
              <Select
                id="send-template"
                labelText="Load Template"
                helperText="Pre-fill subject and body from an active template"
                value={sendForm.template_id}
                onChange={e => loadTemplate(e.target.value)}
              >
                <SelectItem value="" text="No template" />
                {templates
                  .filter(t => t.is_active)
                  .map(t => (
                    <SelectItem key={t.id} value={t.id} text={`${t.name} - ${t.subject}`} />
                  ))}
              </Select>
              <Select
                id="send-client"
                labelText="Or Select Client"
                helperText="Auto-fill recipient email and name"
                value=""
                onChange={e => selectClient(e.target.value)}
              >
                <SelectItem value="" text="Select client" />
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id} text={`${c.name} (${c.email})`} />
                ))}
              </Select>
            </div>
          </div>
        </section>

          {/* Recipient */}
          <section>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Recipient</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextInput
                id="send-email"
                labelText="To Email *"
                type="email"
                placeholder="client@example.com"
                value={sendForm.to_email}
                onChange={e => setSendForm({ ...sendForm, to_email: e.target.value })}
                required
              />
              <TextInput
                id="send-name"
                labelText="To Name"
                placeholder="Client Name"
                value={sendForm.to_name}
                onChange={e => setSendForm({ ...sendForm, to_name: e.target.value })}
              />
            </div>
          </div>
        </section>

          {/* Message */}
          <section>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">Message</h3>
              <div className="space-y-3">
              <TextInput
                id="send-subject"
                labelText="Subject *"
                placeholder="Email subject line"
                value={sendForm.subject}
                onChange={e => setSendForm({ ...sendForm, subject: e.target.value })}
                required
              />
              <TextArea
                id="send-body"
                labelText="Body (HTML)"
                placeholder="<html>...</html>"
                rows={8}
                value={sendForm.body}
                onChange={e => setSendForm({ ...sendForm, body: e.target.value })}
                required
              />
            </div>
          </div>
        </section>
        </form>
      </Modal>
    </div>
  );
};

export default UpdateCenter;
