declare module "node-quickbooks" {
  interface Customer {
    Id: string;
    CompanyName?: string;
    DisplayName: string;
    PrimaryEmailAddr?: {
      Address?: string;
    };
    PrimaryPhone?: {
      FreeFormNumber?: string;
    };
    Active: boolean;
    [key: string]: unknown;
  }

  interface CustomerQueryResult {
    Customer: Customer[];
  }

  type FindCustomersCallback = (err: Error | null, customers: CustomerQueryResult) => void;

  class QuickBooks {
    constructor(
      consumerKey: string,
      consumerSecret: string,
      accessToken: string,
      accessTokenSecret: string | false,
      realmId: string,
      useSandbox: boolean,
      debug?: boolean,
      minorVersion?: number | null,
      oauthVersion?: string,
      refreshToken?: string
    );

    findCustomers(options: { fetchAll: boolean }, callback: FindCustomersCallback): void;
    
    // Add other methods as needed
    createCustomer(customer: Partial<Customer>, callback: (err: Error | null, customer: Customer) => void): void;
    updateCustomer(customer: Partial<Customer>, callback: (err: Error | null, customer: Customer) => void): void;
    getCustomer(id: string, callback: (err: Error | null, customer: Customer) => void): void;
  }

  export = QuickBooks;
}
