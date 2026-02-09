"use client";

import { Upload } from "lucide-react";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";

interface CsvImportButtonProps {
  onClick: () => void;
}

/**
 * Button to open the CSV import dialog.
 * Uses blue icon button with text styling for primary actions.
 */
export function CsvImportButton({ onClick }: CsvImportButtonProps) {
  return (
    <IconButtonWithText
      type="button"
      variant="blue"
      onClick={onClick}
      title="Import clients from CSV"
    >
      <Upload className="h-5 w-5" />
      Import CSV
    </IconButtonWithText>
  );
}
