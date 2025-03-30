# Tearpay

Frontend component for NEAR Intents 1click API. Embed in your apps to accept crypto payments on 12+ blockchains, and receive the payments automatically converted to USDC on NEAR.

[Public Demo](https://tearpay-demo.intear.tech/?amountUsd=0.05&invoiceId=123&recipientAddress=s1ime.near&redirectTo=https://example.com)

Usage:

```jsx
return (
    <Invoice
        amountUsd={100}
        invoiceId="123"
        recipientAddress="s1ime.near"
        redirectTo="https://example.com/" // optional
        showRecipient={false} // show the recipient account id and warning that the creator is not affiliated with TearPay
        onSuccess={() => {}} // optional
        onCancel={() => {}} // optional
    />
)
```

slime spent twice as much time trying to publish this on npm than actually coding this, so fook it, just copy paste Invoice.tsx into your project.
