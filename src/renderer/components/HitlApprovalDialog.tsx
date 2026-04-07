import React, { useEffect, useState } from 'react';
import type { HitlRequest, PermissionScope } from '../types/api';

export default function HitlApprovalDialog() {
  const [request, setRequest] = useState<HitlRequest | null>(null);

  useEffect(() => {
    window.api.onApprovalRequest((req) => setRequest(req));
    return () => window.api.offApprovalRequest();
  }, []);

  if (!request) return null;

  const reply = (approved: boolean, scope: PermissionScope) => {
    window.api.replyApproval(request.replyChannel, approved, scope);
    setRequest(null);
  };

  const actionLabel = request.action === 'read' ? 'đọc' : 'ghi';
  const fileName = request.filePath.split('/').pop() ?? request.filePath;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4 mx-4">
        <div>
          <h3 className="font-semibold text-gray-800">
            Cho phép {actionLabel} file?
          </h3>
          <p className="text-sm text-gray-500 mt-1 break-all">
            <span className="font-mono bg-gray-100 px-1 rounded text-xs">{fileName}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1 break-all">{request.filePath}</p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => reply(true, 'once')}
            className="w-full text-left px-4 py-2.5 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-colors text-sm"
          >
            <span className="font-medium">Cho phép lần này</span>
            <span className="block text-xs text-gray-400">Lần sau sẽ hỏi lại</span>
          </button>
          <button
            onClick={() => reply(true, 'session')}
            className="w-full text-left px-4 py-2.5 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-colors text-sm"
          >
            <span className="font-medium">Cho phép cả session</span>
            <span className="block text-xs text-gray-400">Không hỏi lại cho đến khi đóng app</span>
          </button>
          <button
            onClick={() => reply(true, 'always')}
            className="w-full text-left px-4 py-2.5 rounded-lg border hover:bg-green-50 hover:border-green-300 transition-colors text-sm"
          >
            <span className="font-medium">Luôn cho phép</span>
            <span className="block text-xs text-gray-400">Lưu lại, không hỏi nữa</span>
          </button>
          <button
            onClick={() => reply(false, 'once')}
            className="w-full text-left px-4 py-2.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors text-sm text-red-600"
          >
            Từ chối
          </button>
        </div>
      </div>
    </div>
  );
}
