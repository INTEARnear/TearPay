# Tearpay

Frontend component for NEAR Intents 1click API. Embed in your apps to accept crypto payments on 12+ blockchains.

[Public Demo](https://tearpay-demo.intear.tech/?amountUsd=0.05&invoiceId=123&recipientAddress=s1ime.near&redirectTo=https://example.com)

Usage:

```jsx
return (
    <Invoice
        amountUsd={100}
        invoiceId="123"
        recipientAddress="s1ime.near"
        redirectTo="https://example.com/" // optional
        showRecipient={false}
    />
)
```

slime spent twice as much time trying to publish this on npm than actually coding this, so fook it, just copy paste Invoice.tsx into your project.
