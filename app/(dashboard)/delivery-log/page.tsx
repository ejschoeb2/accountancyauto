import { DeliveryLogTable } from './components/delivery-log-table';

export default function DeliveryLogPage() {
  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-foreground">Delivery Log</h1>
        <p className="text-muted-foreground mt-1">
          View all email delivery history with filters and search
        </p>
      </div>

      <DeliveryLogTable />
    </div>
  );
}
