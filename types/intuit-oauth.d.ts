declare module "intuit-oauth" {
  export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
    created_at?: string;
  }

  export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
    token_type: string;
  }

  export interface OAuthClientOptions {
    clientId: string;
    clientSecret: string;
    environment: string;
    redirectUri: string;
  }

  export interface AuthorizeUriOptions {
    scope: string[];
    state?: string;
  }

  class OAuthClient {
    static environment: {
      sandbox: string;
      production: string;
    };

    static scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      [key: string]: string;
    };

    constructor(options: OAuthClientOptions);

    authorizeUri(options: AuthorizeUriOptions): string;
    createToken(code: string): Promise<AuthResponse>;
    refreshUsingToken(refreshToken: string): Promise<AuthResponse>;
    setToken(token: TokenResponse): void;
    getToken(): TokenResponse;
  }

  export = OAuthClient;
}
