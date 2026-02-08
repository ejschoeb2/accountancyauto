"use client";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvImportButtonProps {
  onClick: () => void;
}

/**
 * Button to open the CSV import dialog.
 * Uses primary button styling like other main action buttons.
 */
export function CsvImportButton({ onClick }: CsvImportButtonProps) {
  return (
    <Button onClick={onClick} className="active:scale-[0.97]">
      <Upload className="size-4" />
      Import CSV
    </Button>
  );
}
