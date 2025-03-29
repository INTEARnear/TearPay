import Invoice from '@/components/Invoice';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const amountUsd = params.amountUsd ? parseFloat(params.amountUsd as string) : 0.99;
  const invoiceId = (params.invoiceId as string) || "test";
  const recipientAddress = (params.recipientAddress as string) || "slimedragon.near";
  const redirectTo = (params.redirectTo as string) || "https://example.com";

  return (
    <main className="min-h-screen bg-gray-950 py-12 px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold text-center text-white mb-12">TearPay Demo</h1>
        <Invoice 
          amountUsd={amountUsd}
          invoiceId={invoiceId}
          recipientAddress={recipientAddress}
          redirectTo={redirectTo}
          showRecipient={true}
        />
      </div>
    </main>
  );
}
