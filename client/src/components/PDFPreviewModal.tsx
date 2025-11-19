import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface PDFPreviewModalProps {
  open: boolean;
  onClose: () => void;
  fileId: number | null;
  fileName: string;
}

export default function PDFPreviewModal({ open, onClose, fileId, fileName }: PDFPreviewModalProps) {
  if (!fileId) return null;

  const fileUrl = `/api/referral-files/${fileId}/download`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">{fileName}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                data-testid="button-download-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                data-testid="button-close-preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <iframe
            src={fileUrl}
            className="w-full h-full border-0"
            title={`PDF Preview: ${fileName}`}
            data-testid="pdf-preview-iframe"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
