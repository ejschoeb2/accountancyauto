"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

interface CsvImportButtonProps {
  onClick: () => void;
}

/**
 * Button to open the CSV import dialog.
 * Uses secondary/outline style as it's not the primary action.
 */
export function CsvImportButton({ onClick }: CsvImportButtonProps) {
  return (
    <Button variant="outline" onClick={onClick}>
      <Icon name="upload" size="sm" />
      Import CSV
    </Button>
  );
}
