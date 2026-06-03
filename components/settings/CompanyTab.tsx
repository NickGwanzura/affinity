import React, { useState } from 'react';
import { ZodError } from 'zod';
import { TextInput, TextArea, Button, Tile, Stack, InlineNotification } from '../ui';
import { Settings as SettingsIcon } from 'lucide-react';
import { CompanyDetails } from '../../types';
import { dataService } from '../../services/dataService';
import { useToast } from '../Toast';
import {
  companyDetailsFormSchema,
  getFirstValidationMessage,
} from '../../utils/clientValidation';

interface CompanyTabProps {
  company: CompanyDetails | null;
  setCompany: React.Dispatch<React.SetStateAction<CompanyDetails | null>>;
}

export const CompanyTab: React.FC<CompanyTabProps> = ({ company, setCompany }) => {
  const { showToast } = useToast();
  const [saveStatus, setSaveStatus] = useState<string>('');

  const setStatusMessage = (
    message: string,
    toastType: Parameters<typeof showToast>[1] = 'success'
  ) => {
    setSaveStatus(message);
    showToast(message, toastType);
    window.setTimeout(() => setSaveStatus(''), 4000);
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      companyDetailsFormSchema.parse(company);
      await dataService.updateCompanyDetails(company);
      setStatusMessage('Business details saved.');
    } catch (error) {
      console.error('Error saving company details:', error);
      const message =
        error instanceof ZodError
          ? getFirstValidationMessage(error)
          : 'Error saving company details. Please try again.';
      setStatusMessage(message, 'error');
    }
  };

  if (!company) return null;

  return (
    <form onSubmit={handleCompanySubmit}>
      <Stack gap={6}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <TextInput
            id="company-name"
            labelText="Legal Company Name"
            value={company.name}
            onChange={e => setCompany({ ...company, name: e.target.value })}
          />
          <TextInput
            id="company-reg"
            labelText="Registration Number"
            value={company.registration_no}
            onChange={e => setCompany({ ...company, registration_no: e.target.value })}
          />
          <TextInput
            id="company-tax"
            labelText="Tax / VAT ID"
            value={company.tax_id}
            onChange={e => setCompany({ ...company, tax_id: e.target.value })}
          />
          <TextInput
            id="company-email"
            type="email"
            labelText="HQ Contact Email"
            value={company.contact_email}
            onChange={e => setCompany({ ...company, contact_email: e.target.value })}
          />
          <TextInput
            id="company-phone"
            type="tel"
            labelText="Phone Number"
            value={company.phone ?? ''}
            onChange={e => setCompany({ ...company, phone: e.target.value })}
          />
          <TextInput
            id="company-website"
            type="url"
            labelText="Website"
            placeholder="https://example.com"
            value={company.website ?? ''}
            onChange={e => setCompany({ ...company, website: e.target.value })}
          />
        </div>
        <TextArea
          id="company-address"
          labelText="HQ Address"
          rows={3}
          value={company.address}
          onChange={e => setCompany({ ...company, address: e.target.value })}
        />
        <TextInput
          id="company-logo"
          type="url"
          labelText="Company Logo URL"
          helperText="PDFs now use the built-in Affinity logo. This URL is optional for other branded surfaces."
          placeholder="https://example.com/logo.png"
          value={company.logo_url ?? ''}
          onChange={e => setCompany({ ...company, logo_url: e.target.value })}
        />
        {company.logo_url && (
          <Tile style={{ padding: '1rem', background: '#ffffff' }}>
            <p
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#52525b',
                marginBottom: '0.75rem',
              }}
            >
              Logo Preview:
            </p>
            <img
              src={company.logo_url}
              alt="Company Logo"
              style={{ height: '4rem', objectFit: 'contain' }}
              onError={e => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="50"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999"%3EInvalid URL%3C/text%3E%3C/svg%3E';
              }}
            />
          </Tile>
        )}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '1rem' }}
        >
          <Button type="submit" leftIcon={<SettingsIcon size={14} />}>
            Save Business Details
          </Button>
          {saveStatus && (
            <InlineNotification
              kind="success"
              title="Saved"
              subtitle={saveStatus}
              hideCloseButton
            />
          )}
        </div>
      </Stack>
    </form>
  );
};

export default CompanyTab;
