/** Card terminals plug in behind this interface. The sale screen uses a mock provider for now. */
export interface CardPaymentRequest {
  amountPence: number;
  currency: "GBP";
  reference: string;
}

export interface CardPaymentResult {
  approved: boolean;
  authCode?: string;
  message: string;
}

export interface PaymentProvider {
  payByCard(request: CardPaymentRequest): Promise<CardPaymentResult>;
}

/** Receipt printers plug in behind this interface. ESC/POS can replace the browser print path. */
export interface PrinterProvider {
  printReceipt(html: string, jobName: string): Promise<void>;
  openDrawer(): Promise<void>;
}

export class MockPaymentProvider implements PaymentProvider {
  constructor(private readonly ask: (amountPence: number) => Promise<boolean>) {}

  async payByCard(request: CardPaymentRequest): Promise<CardPaymentResult> {
    const approved = await this.ask(request.amountPence);
    if (!approved) return { approved: false, message: "Declined" };
    return { approved: true, authCode: `MOCK${request.reference.slice(-6)}`, message: "Approved" };
  }
}
