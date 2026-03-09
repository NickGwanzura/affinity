
import React, { useState, useEffect, useRef } from 'react';
import { Currency, ExpenseCategory, Vehicle, VehicleStatus } from '../types';
import { supabase } from '../services/supabaseService';
import { supabaseClient } from '../services/supabaseClient';

export const DriverPortal: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('NAD');
  const [category, setCategory] = useState<ExpenseCategory>('Fuel');
  const [location, setLocation] = useState<VehicleStatus>('Namibia');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const data = await supabase.getVehicles();
        setVehicles(data);
      } catch (error) {
        setUploadError('Failed to load vehicles. Please refresh the page.');
      }
    };
    loadVehicles();
  }, []);

  // Cleanup object URL to prevent memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUploadError('Please select an image file');
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('File size must be less than 10MB');
        return;
      }
      
      // Cleanup previous preview URL before creating new one
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      setSelectedFile(file);
      setUploadError('');
      // Create preview URL using FileReader
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.onerror = () => {
        setUploadError('Failed to read file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      setUploadError('');

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabaseClient.storage
        .from('receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabaseClient.storage
        .from('receipts')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      return urlData.publicUrl;
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload receipt. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    setSubmitting(true);
    setUploadError('');
    
    try {
      let receiptUrl: string | undefined = undefined;

      // Upload receipt if file is selected
      if (selectedFile) {
        receiptUrl = await uploadReceipt(selectedFile);
        if (!receiptUrl) {
          // Upload failed, but don't block submission
          setUploadError('Receipt upload failed, continuing without receipt. You may want to retry.');
        }
      }

      await supabase.addExpense({
        vehicle_id: selectedVehicle || undefined,
        description,
        amount: parseFloat(amount),
        currency,
        category,
        location,
        receipt_url: receiptUrl
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Reset form
      setDescription('');
      setAmount('');
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      setUploadError(error.message || 'Failed to submit expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearReceipt = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-zinc-200 font-sans">
      <div className="bg-zinc-900 p-6 text-white text-center">
        <h2 className="text-2xl font-bold">Driver Log</h2>
        <p className="text-zinc-400 text-sm mt-1">Submit transit expenses in real-time</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {success && (
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg border border-emerald-200 flex items-center gap-2 animate-bounce font-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Expense logged successfully!
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="vehicle-select" className="text-sm font-semibold text-zinc-700">
            Vehicle Selection <span className="text-zinc-400 text-xs">(Optional)</span>
          </label>
          <select
            id="vehicle-select"
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
          >
            <option value="">None (General expense)</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.make_model} ({v.vin_number})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="amount-input" className="text-sm font-semibold text-zinc-700">Amount</label>
            <input
              id="amount-input"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              autoComplete="off"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="currency-select" className="text-sm font-semibold text-zinc-700">Currency</label>
            <select
              id="currency-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="NAD">NAD (Namibia)</option>
              <option value="GBP">GBP (UK)</option>
              <option value="USD">USD (General)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="category-select" className="text-sm font-semibold text-zinc-700">Category</label>
            <select
              id="category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="Fuel">Fuel</option>
              <option value="Tolls">Tolls</option>
              <option value="Food">Food</option>
              <option value="Repairs">Repairs</option>
              <option value="Duty">Duty</option>
              <option value="Shipping">Shipping</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="location-select" className="text-sm font-semibold text-zinc-700">Current Location</label>
            <select
              id="location-select"
              value={location}
              onChange={(e) => setLocation(e.target.value as VehicleStatus)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="UK">UK</option>
              <option value="Namibia">Namibia</option>
              <option value="Zimbabwe">Zimbabwe</option>
              <option value="Botswana">Botswana</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="description-input" className="text-sm font-semibold text-zinc-700">
            Description {category === 'Other' && <span className="text-red-500">*</span>}
          </label>
          <textarea
            id="description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={category === 'Other' ? "Please specify the type of expense" : "E.g. Full tank at Engen Windhoek"}
            rows={2}
            required={category === 'Other'}
            autoComplete="off"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
          {category === 'Other' && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Required: Please describe what this expense is for
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="receipt-input" className="text-sm font-semibold text-zinc-700">
            Receipt Image <span className="text-zinc-400 text-xs">(Optional)</span>
          </label>
          {previewUrl ? (
            <div className="relative border-2 border-zinc-200 rounded-xl overflow-hidden">
              <img src={previewUrl} alt="Receipt preview" className="w-full h-48 object-cover" />
              <button
                type="button"
                onClick={clearReceipt}
                aria-label="Remove receipt image"
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2">
                {selectedFile?.name}
              </div>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              role="button"
              tabIndex={0}
              aria-label="Click to upload receipt image"
              className="border-2 border-dashed border-zinc-200 rounded-xl p-4 flex flex-col items-center justify-center bg-transparent hover:bg-zinc-50 transition-colors cursor-pointer group"
            >
              <svg className="w-8 h-8 text-zinc-300 group-hover:text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs text-zinc-400 group-hover:text-blue-600 font-medium font-sans">Capture or Upload Receipt</span>
              <span className="text-xs text-zinc-300 mt-1">Click to select image (max 10MB)</span>
            </div>
          )}
          <input 
            ref={fileInputRef}
            id="receipt-input"
            type="file" 
            accept="image/*" 
            capture="environment" 
            onChange={handleFileSelect}
            className="hidden" 
            aria-label="Receipt file input"
          />
          {uploadError && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1" role="alert">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {uploadError}
            </p>
          )}
          {uploading && (
            <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
              <span className="h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
              Uploading receipt...
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 font-sans"
        >
          {submitting ? (
            <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="Submitting expense"></span>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Submit Expense
            </>
          )}
        </button>
      </form>
    </div>
  );
};
