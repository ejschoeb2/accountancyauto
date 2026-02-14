'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { HelpCircle, ArrowRight } from 'lucide-react';

export function HelpWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Getting Started
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          href="/templates"
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          • Manage email templates
        </Link>
        <Link
          href="/schedules"
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          • Configure reminder schedules
        </Link>
        <Link
          href="/clients"
          className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          • Import and manage clients
        </Link>
      </CardContent>
      <CardFooter>
        <Button variant="outline" asChild className="w-full">
          <Link href="/help">
            View Help
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
