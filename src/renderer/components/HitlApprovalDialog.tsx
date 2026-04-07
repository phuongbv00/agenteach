import { useEffect, useState } from 'react';
import type { HitlRequest, PermissionScope } from '../types/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function HitlApprovalDialog() {
  const [request, setRequest] = useState<HitlRequest | null>(null);

  useEffect(() => {
    window.api.onApprovalRequest((req) => setRequest(req));
    return () => window.api.offApprovalRequest();
  }, []);

  const reply = (approved: boolean, scope: PermissionScope) => {
    if (!request) return;
    window.api.replyApproval(request.replyChannel, approved, scope);
    setRequest(null);
  };

  if (!request) return null;

  const actionLabel = request.action === 'read' ? 'đọc' : 'ghi';
  const fileName = request.filePath.split('/').pop() ?? request.filePath;

  return (
    <Dialog open onOpenChange={() => reply(false, 'once')}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cho phép {actionLabel} file?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground break-all">
          <span className="font-mono bg-muted px-1 rounded text-xs">{fileName}</span>
        </p>
        <p className="text-xs text-muted-foreground break-all">{request.filePath}</p>

        <div className="space-y-2 pt-2">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-2.5"
            onClick={() => reply(true, 'once')}
          >
            <div className="text-left">
              <p className="font-medium text-sm">Cho phép lần này</p>
              <p className="text-xs text-muted-foreground font-normal">Lần sau sẽ hỏi lại</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-2.5"
            onClick={() => reply(true, 'session')}
          >
            <div className="text-left">
              <p className="font-medium text-sm">Cho phép cả session</p>
              <p className="text-xs text-muted-foreground font-normal">Không hỏi lại cho đến khi đóng app</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-2.5 border-primary/20 hover:bg-primary/5 hover:border-primary/40"
            onClick={() => reply(true, 'always')}
          >
            <div className="text-left">
              <p className="font-medium text-sm">Luôn cho phép</p>
              <p className="text-xs text-muted-foreground font-normal">Lưu lại, không hỏi nữa</p>
            </div>
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => reply(false, 'once')}
          >
            Từ chối
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
