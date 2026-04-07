import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import type { AllMemory, MemoryLayer, AIProvider } from '../types/api';
import { randomUUID } from '../utils/uuid';

interface ListEditorProps {
  label: string;
  placeholder: string;
  items: string[];
  onAdd: () => void;
  onChange: (i: number, val: string) => void;
  onRemove: (i: number) => void;
}

function ListEditor({ label, placeholder, items, onAdd, onChange, onRemove }: ListEditorProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <button onClick={onAdd} className="text-xs text-blue-500 hover:text-blue-700 font-medium">+ Thêm</button>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-xs text-gray-400 italic">Chưa có.</p>}
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={item} onChange={(e) => onChange(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <button onClick={() => onRemove(i)} className="text-gray-400 hover:text-red-500 px-2">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  onClose: () => void;
}

type Tab = 'connection' | 'memory' | 'support';

const EMPTY_PROVIDER: AIProvider = { id: '', name: '', baseUrl: 'http://localhost:11434/v1', apiKey: '' };

export default function SettingsPanel({ onClose }: Props) {
  const { config, setConfig, activeWorkspace } = useAppStore();

  // ── Provider state ───────────────────────────────────────────
  const [providers, setProviders] = useState<AIProvider[]>(config?.providers ?? []);
  const [activeProviderId, setActiveProviderIdState] = useState(config?.activeProviderId ?? null);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(config?.selectedModel ?? '');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'ok' | 'fail' | null>(null);

  // ── Memory state ────────────────────────────────────────────
  const [allMemory, setAllMemory] = useState<AllMemory | null>(null);
  const [memSaving, setMemSaving] = useState(false);
  const [memSaved, setMemSaved] = useState(false);

  const [tab, setTab] = useState<Tab>('connection');

  const { activeSessionId } = useAppStore();

  useEffect(() => {
    if (activeWorkspace) {
      window.api.getAllMemory().then(setAllMemory);
    }
  }, [activeWorkspace?.id]);

  // Reload models for active provider on mount
  useEffect(() => {
    const active = providers.find((p) => p.id === activeProviderId);
    if (active) window.api.listProviderModels(active).then(setProviderModels);
  }, [activeProviderId]);

  // ── Provider handlers ────────────────────────────────────────
  const handleCheckProvider = async (provider: AIProvider) => {
    setChecking(true);
    setCheckResult(null);
    const ok = await window.api.checkProvider(provider);
    setCheckResult(ok ? 'ok' : 'fail');
    setChecking(false);
    if (ok) {
      const list = await window.api.listProviderModels(provider);
      setProviderModels(list);
    }
  };

  const handleSaveProvider = async (provider: AIProvider) => {
    await window.api.saveProvider(provider);
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    setProviders(cfg.providers);
    setEditingProvider(null);
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Xoá provider này?')) return;
    await window.api.deleteProvider(id);
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    setProviders(cfg.providers);
    setActiveProviderIdState(cfg.activeProviderId);
  };

  const handleSetActiveProvider = async (id: string) => {
    await window.api.setActiveProvider(id);
    setActiveProviderIdState(id);
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    const active = cfg.providers.find((p) => p.id === id);
    if (active) {
      const list = await window.api.listProviderModels(active);
      setProviderModels(list);
    }
  };

  const handleSaveModel = async () => {
    await window.api.selectModel(selectedModel);
    setConfig(await window.api.getConfig());
  };

  // ── Memory helpers ───────────────────────────────────────────
  type Layer = 'global' | 'workspace';

  const setLayer = (layer: Layer, updater: (m: MemoryLayer) => MemoryLayer) =>
    setAllMemory((all) => all ? { ...all, [layer]: updater(all[layer]) } : all);

  const addListItem = (layer: Layer, field: 'feedback' | 'context') =>
    setLayer(layer, (m) => ({ ...m, [field]: [...m[field], ''] }));

  const updateListItem = (layer: Layer, field: 'feedback' | 'context', i: number, val: string) =>
    setLayer(layer, (m) => {
      const arr = [...m[field]]; arr[i] = val; return { ...m, [field]: arr };
    });

  const removeListItem = (layer: Layer, field: 'feedback' | 'context', i: number) =>
    setLayer(layer, (m) => ({ ...m, [field]: m[field].filter((_, idx) => idx !== i) }));

  // ── Memory save ──────────────────────────────────────────────
  const handleSaveMemory = async () => {
    if (!allMemory) return;
    setMemSaving(true);
    await Promise.all([
      window.api.updateGlobalMemory(allMemory.global as unknown as Record<string, unknown>),
      window.api.updateWorkspaceMemory(allMemory.workspace as unknown as Record<string, unknown>),
    ]);
    setMemSaving(false);
    setMemSaved(true);
    setTimeout(() => setMemSaved(false), 2000);
  };

  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<'ok' | 'cancel' | null>(null);

  const handleExportLogs = async () => {
    setExporting(true);
    setExportResult(null);
    const ok = await window.api.exportLogs();
    setExportResult(ok ? 'ok' : 'cancel');
    setExporting(false);
    setTimeout(() => setExportResult(null), 3000);
  };

  const TAB_LABELS: Record<Tab, string> = {
    connection: '🔌 Kết nối AI',
    memory: '🧠 Bộ nhớ',
    support: '🛟 Hỗ trợ',
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">Cài đặt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4 flex-shrink-0">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── Tab: Connection ── */}
          {tab === 'connection' && (
            <>
              {/* Provider list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">AI Providers</h3>
                  <button
                    onClick={() => setEditingProvider({ ...EMPTY_PROVIDER, id: randomUUID() })}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                  >+ Thêm provider</button>
                </div>
                <div className="space-y-2">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-3 border rounded-xl transition-colors ${p.id === activeProviderId ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <button onClick={() => handleSetActiveProvider(p.id)}
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${p.id === activeProviderId ? 'border-blue-500' : 'border-gray-300'}`}>
                        {p.id === activeProviderId && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{p.name || '(chưa đặt tên)'}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">{p.baseUrl}</p>
                      </div>
                      <button onClick={() => setEditingProvider({ ...p })}
                        className="text-xs text-gray-400 hover:text-blue-500 px-1">✎</button>
                      {providers.length > 1 && (
                        <button onClick={() => handleDeleteProvider(p.id)}
                          className="text-xs text-gray-400 hover:text-red-500 px-1">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Edit/Add provider form */}
              {editingProvider && (
                <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-700">
                    {providers.find((p) => p.id === editingProvider.id) ? 'Sửa provider' : 'Thêm provider'}
                  </h4>
                  {[
                    { label: 'Tên', key: 'name', placeholder: 'VD: Ollama local', mono: false },
                    { label: 'Base URL', key: 'baseUrl', placeholder: 'http://localhost:11434/v1', mono: true },
                    { label: 'API Key', key: 'apiKey', placeholder: 'Để trống nếu không cần', mono: true },
                  ].map(({ label, key, placeholder, mono }) => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="text-xs text-gray-500 w-16 flex-shrink-0">{label}</label>
                      <input type={key === 'apiKey' ? 'password' : 'text'}
                        value={(editingProvider as Record<string, string>)[key]}
                        onChange={(e) => setEditingProvider({ ...editingProvider, [key]: e.target.value })}
                        placeholder={placeholder}
                        className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${mono ? 'font-mono' : ''}`}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleCheckProvider(editingProvider)} disabled={checking}
                      className="px-3 py-1.5 text-xs border rounded-lg text-gray-600 hover:bg-white disabled:opacity-50">
                      {checking ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                    </button>
                    {checkResult === 'ok' && <span className="text-xs text-green-600 self-center">✅ OK</span>}
                    {checkResult === 'fail' && <span className="text-xs text-red-600 self-center">❌ Lỗi</span>}
                    <div className="flex-1" />
                    <button onClick={() => { setEditingProvider(null); setCheckResult(null); }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Huỷ</button>
                    <button onClick={() => handleSaveProvider(editingProvider)}
                      className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg">Lưu</button>
                  </div>
                </div>
              )}

              {/* Model selection */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Model đang dùng</h3>
                <div className="space-y-2">
                  {providerModels.length === 0 && (
                    <p className="text-xs text-gray-400">Chưa có model — kiểm tra kết nối provider.</p>
                  )}
                  {providerModels.map((m) => (
                    <label key={m} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${selectedModel === m ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <input type="radio" name="model" value={m} checked={selectedModel === m}
                        onChange={() => setSelectedModel(m)} className="accent-blue-500" />
                      <span className="text-sm font-mono text-gray-700">{m}</span>
                      {config?.selectedModel === m && <span className="ml-auto text-xs text-blue-500 font-medium">Đang dùng</span>}
                    </label>
                  ))}
                  <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${!providerModels.includes(selectedModel) && selectedModel ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <input type="radio" name="model" checked={!providerModels.includes(selectedModel) && !!selectedModel}
                      onChange={() => {}} className="accent-blue-500" />
                    <input type="text" placeholder="Nhập tên model..."
                      value={!providerModels.includes(selectedModel) ? selectedModel : ''}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="text-sm flex-1 outline-none bg-transparent font-mono text-gray-700 placeholder-gray-400" />
                  </label>
                </div>
                <button onClick={handleSaveModel} disabled={!selectedModel}
                  className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-xl disabled:opacity-40 transition-colors">
                  Lưu model
                </button>
              </div>
            </>
          )}

          {/* ── Tab: Support ── */}
          {tab === 'support' && (
            <div className="space-y-4">
              <div className="border rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Logs ứng dụng</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  File log ghi lại toàn bộ hoạt động của ứng dụng (main process, renderer, lỗi). Gửi file này khi báo lỗi để được hỗ trợ nhanh hơn.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportLogs}
                    disabled={exporting}
                    className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-900 text-white rounded-xl disabled:opacity-50 transition-colors"
                  >
                    {exporting ? 'Đang xuất...' : 'Tải xuống logs'}
                  </button>
                  {exportResult === 'ok' && <span className="text-xs text-green-600">✓ Đã lưu file</span>}
                  {exportResult === 'cancel' && <span className="text-xs text-gray-400">Đã huỷ</span>}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Memory ── */}
          {tab === 'memory' && (
            <>
              {!activeWorkspace ? (
                <p className="text-sm text-gray-400">Chọn một workspace để xem bộ nhớ.</p>
              ) : !allMemory ? (
                <p className="text-sm text-gray-400">Đang tải...</p>
              ) : (
                <>
                  {/* ── Global ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Toàn cục</span>
                      <p className="text-xs text-gray-400">Áp dụng mọi workspace</p>
                    </div>
                    <div className="space-y-2 mb-3">
                      {([
                        { label: 'Tên', key: 'name', placeholder: 'VD: Nguyễn Thị Lan' },
                        { label: 'Môn dạy', key: 'subject', placeholder: 'VD: Toán, Ngữ văn...' },
                        { label: 'Lớp dạy', key: 'grades', placeholder: 'VD: 10A1, 11B2' },
                      ] as const).map(({ label, key, placeholder }) => (
                        <div key={key} className="flex items-center gap-3">
                          <label className="text-sm text-gray-500 w-20 flex-shrink-0">{label}</label>
                          <input type="text"
                            value={key === 'grades' ? allMemory.global.user.grades.join(', ') : allMemory.global.user[key]}
                            onChange={(e) => {
                              const val = key === 'grades'
                                ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                                : e.target.value;
                              setLayer('global', (m) => ({ ...m, user: { ...m.user, [key]: val } }));
                            }}
                            placeholder={placeholder}
                            className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                      ))}
                    </div>
                    <ListEditor
                      label="Lưu ý cho trợ lý" placeholder="VD: Không dùng bullet point"
                      items={allMemory.global.feedback}
                      onAdd={() => addListItem('global', 'feedback')}
                      onChange={(i, v) => updateListItem('global', 'feedback', i, v)}
                      onRemove={(i) => removeListItem('global', 'feedback', i)}
                    />
                    {Object.keys(allMemory.global.style).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-400 mb-1">Phong cách (tự học):</p>
                        {Object.entries(allMemory.global.style).map(([k, v]) => (
                          <div key={k} className="bg-gray-50 rounded-lg px-3 py-2 text-xs mb-1">
                            <span className="text-gray-400 font-medium">{k}:</span> <span className="text-gray-700">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Workspace ── */}
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Workspace</span>
                      <p className="text-xs text-gray-400">Chỉ trong "{activeWorkspace.name}"</p>
                    </div>
                    <ListEditor
                      label="Bối cảnh dự án" placeholder="VD: Đang soạn đề HK1 môn Toán 10"
                      items={allMemory.workspace.context}
                      onAdd={() => addListItem('workspace', 'context')}
                      onChange={(i, v) => updateListItem('workspace', 'context', i, v)}
                      onRemove={(i) => removeListItem('workspace', 'context', i)}
                    />
                    <div className="mt-3">
                      <ListEditor
                        label="Lưu ý riêng workspace" placeholder="VD: Tài liệu lưu trong thư mục De_thi"
                        items={allMemory.workspace.feedback}
                        onAdd={() => addListItem('workspace', 'feedback')}
                        onChange={(i, v) => updateListItem('workspace', 'feedback', i, v)}
                        onRemove={(i) => removeListItem('workspace', 'feedback', i)}
                      />
                    </div>
                  </div>

                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border rounded-xl transition-colors">
            Đóng
          </button>
          {tab === 'memory' && activeWorkspace && allMemory && (
            <button onClick={handleSaveMemory} disabled={memSaving}
              className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-xl disabled:opacity-50 transition-colors">
              {memSaved ? '✓ Đã lưu' : memSaving ? 'Đang lưu...' : 'Lưu'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
