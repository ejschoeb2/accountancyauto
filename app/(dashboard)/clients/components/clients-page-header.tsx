"use client";

import { useState } from "react";
import { CsvImportButton } from "./csv-import-button";
import { CsvImportDialog } from "./csv-import-dialog";

export function ClientsPageHeader() {
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);

  const handleImportComplete = () => {
    window.location.reload();
  };

  return (
    <>
      {/* Page header with Import CSV button */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-foreground">Clients</h1>
          <p className="text-muted-foreground">
            Manage your client records and reminder settings
          </p>
        </div>
        <CsvImportButton onClick={() => setIsCsvDialogOpen(true)} />
      </div>

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={isCsvDialogOpen}
        onOpenChange={setIsCsvDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </>
  );
}
