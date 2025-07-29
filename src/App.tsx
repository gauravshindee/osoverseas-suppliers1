import React, { useState, useRef } from 'react';
import { storage, db } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import Tesseract from 'tesseract.js';
import mammoth from 'mammoth';

const logoUrl = 'https://ext.same-assets.com/3896384637/3933379453.svg';

interface QuotationDoc {
  id?: string;
  fileUrl: string;
  filename: string;
  type: string;
  uploaded: string;
  extractedText: string;
  error?: string;
}

function withTimeout<T>(promise: Promise<T>, ms = 10000) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Extraction timed out')), ms))
  ]);
}

async function extractText(file: File): Promise<string> {
  const type = file.type;
  console.log('Extracting:', type, file.name);
  if (type.startsWith('image/')) {
    const result = await withTimeout(Tesseract.recognize(file, 'eng', { logger: () => {} }));
    return result.data.text || '';
  }
  if (type === 'application/pdf') {
    // Never block or timeout, return immediately
    return '[PDF text extraction coming soon]';
  }
  if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const arrayBuffer = await withTimeout(file.arrayBuffer());
    const result = await withTimeout(mammoth.extractRawText({ arrayBuffer }));
    return result.value || '';
  }
  if (type.startsWith('text/')) {
    const txt = await withTimeout(file.text());
    return txt;
  }
  return '[Unsupported file type]';
}

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [quotations, setQuotations] = useState<QuotationDoc[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string|null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    setProcessing(true);
    setProgress(0);
    setError(null);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let extractedText = '';
      let errorMsg = '';
      setStep(`Extracting text: ${file.name}`);
      try {
        extractedText = await extractText(file);
      } catch (err: unknown) {
        errorMsg = (err as Error)?.message || 'Extraction failed';
        setError(`Extraction failed: ${file.name}: ${errorMsg}`);
      }
      setStep(`Uploading: ${file.name}`);
      try {
        const storageRef = ref(storage, `quotations/${file.name}_${Date.now()}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        const record = {
          fileUrl: url,
          filename: file.name,
          type: file.type,
          uploaded: new Date().toISOString(),
          extractedText: extractedText?.slice(0,600),
          ...(errorMsg ? {error: errorMsg} : {}),
        };
        await addDoc(collection(db, 'quotations'), record);
      } catch (err: unknown) {
        const upErr = (err as Error)?.message || 'Upload failed';
        setError(`Upload failed: ${file.name}: ${upErr}`);
      }
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }
    setProcessing(false);
    setFiles([]);
    setStep('');
    await fetchQuotations();
  };

  async function fetchQuotations() {
    const snapshot = await getDocs(collection(db, 'quotations'));
    const data: QuotationDoc[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as QuotationDoc);
    setQuotations(data.sort((a, b) => b.uploaded.localeCompare(a.uploaded)));
  }

  React.useEffect(() => { fetchQuotations(); }, []);

  const filteredQuotations = quotations;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full flex items-center bg-blue-700 px-6 py-4 shadow">
        <img src={logoUrl} alt="OS Overseas logo" className="h-10 w-10 mr-4" />
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Quotation Vault &ndash; OS Overseas
        </h1>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-10">
        <section className="mb-10">
          <div className="mb-6 bg-white border border-blue-200 rounded-lg shadow-sm p-6 flex flex-col items-center">
            <label className="text-blue-800 font-semibold mb-2 block">Upload a quotation file</label>
            <input
              ref={inputRef}
              onChange={handleFilesChange}
              type="file"
              multiple
              className="block file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white file:mr-4 file:cursor-pointer"
            />
            {files.length > 0 && (
              <div className="mt-4 w-full">
                <h3 className="text-blue-800 text-sm mb-1 font-medium">Selected files:</h3>
                <ul className="text-xs text-blue-900">
                  {files.map((file) => (
                    <li key={file.name + file.lastModified}>{file.name}</li>
                  ))}
                </ul>
                <button
                  disabled={processing}
                  onClick={handleUpload}
                  className="inline-block px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold mt-4 rounded shadow"
                >
                  {processing ? 'Uploading…' : 'Upload now'}
                </button>
              </div>
            )}
            {processing && (
              <div className="mt-3 text-blue-700">
                {step ? step : 'Processing...'} {progress > 0 ? `${progress}%` : ''}
              </div>
            )}
            {error && <div className="text-red-600 mt-2 text-xs">{error}</div>}
          </div>
        </section>
        <div className="rounded-xl shadow-lg border border-blue-100 bg-blue-50 py-6 px-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-blue-700 text-lg font-semibold">
              Uploaded Quotations
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="ml-3 text-sm px-3 py-2 border border-blue-200 rounded outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Search quotations... (coming soon)"
              disabled={quotations.length < 1}
            />
          </div>
          {filteredQuotations.length === 0 && (
            <div className="text-blue-800/80 my-12 text-center">No quotations uploaded yet.</div>
          )}
          {filteredQuotations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-blue-900">Filename</th>
                    <th className="p-2 text-left text-blue-900">File type</th>
                    <th className="p-2 text-left text-blue-900">Date</th>
                    <th className="p-2 text-left text-blue-900">Link</th>
                    <th className="p-2 text-left text-blue-900">Extracted Text (summary)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotations.map((q) => (
                    <tr key={q.id} className="border-t border-blue-100 hover:bg-blue-100/40">
                      <td className="p-2">{q.filename}</td>
                      <td className="p-2">{q.type}</td>
                      <td className="p-2 whitespace-nowrap">{new Date(q.uploaded).toLocaleString()}</td>
                      <td className="p-2">
                        <a href={q.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">open</a>
                        {q.error && <div className="text-xs text-red-600">{q.error}</div>}
                      </td>
                      <td className="p-2 max-w-xs text-xs text-blue-950/70">
                        {q.extractedText
                          ? q.extractedText.split("\n").slice(0, 2).join(" ")
                          : <span className="italic text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <footer className="text-center py-4 text-xs text-blue-800 bg-blue-50">
        &copy; OS Overseas {new Date().getFullYear()}
      </footer>
    </div>
  );
}
