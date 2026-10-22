import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Building2, Check, CheckCircle2, Copy, Wallet } from "lucide-react";
import { toast } from "sonner";

import { getTransferDetails, submitTransfer } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import btcQr from "@/assets/btc-payment-qr.jpeg.asset.json";
import usdtQr from "@/assets/usdt-payment-qr.jpeg.asset.json";

type Method = "bank" | "btc" | "usdt";

const cryptoPayments = {
  btc: { image: btcQr.url, label: "Bitcoin", symbol: "BTC", address: "15uC5SxDBZCuC52MZDAHHcHUB1a4FBBEDk" },
  usdt: { image: usdtQr.url, label: "Tether", symbol: "USDT", address: "0x1bb5d8ff4be81577e70c4872daef13065b46abc7" },
};

export function ShipmentTransfer(props: {
  shipmentId: string; tracking: string; amount: string;
  submittedAt: string | null; submittedMethod: string | null; submittedRef: string | null;
}) {
  const qc = useQueryClient();
  const submit = useServerFn(submitTransfer);
  const fetchTransferDetails = useServerFn(getTransferDetails);
  const { data: transferDetails, isPending: isLoadingBankDetails, isError: bankDetailsError } = useQuery({
    queryKey: ["transfer-details"],
    queryFn: () => fetchTransferDetails(),
    staleTime: 5 * 60 * 1000,
  });
  const [method, setMethod] = useState<Method>("bank");
  const [ref, setRef] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const payment = method === "bank" ? null : cryptoPayments[method];
  const bankRows: [string, string | undefined][] = [
    ["Bank", transferDetails?.bankName],
    ["Account name", transferDetails?.accountName],
    ["Account number / IBAN", transferDetails?.accountNumber],
    ["SWIFT / sort code", transferDetails?.swift],
  ];
  const hasBankDetails = bankRows.some(([, value]) => value?.trim());
  const m = useMutation({
    mutationFn: () => submit({ data: { id: props.shipmentId, method, reference: ref } }),
    onSuccess: () => {
      toast.success("Payment reference submitted — awaiting team verification");
      setRef("");
      void qc.invalidateQueries({ queryKey: ["shipment", props.shipmentId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const copyAddress = async () => {
    if (!payment) return;
    try {
      await navigator.clipboard.writeText(payment.address);
      setCopied(payment.address);
      toast.success("Wallet address copied");
    } catch {
      toast.error("Could not copy. Please select and copy the wallet address.");
    }
  };

  return (
    <section aria-label="Shipment payment" className="overflow-hidden rounded-lg border border-line bg-card">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-8">
        <div>
          <div className="flex items-center gap-2 text-primary"><Wallet className="size-4" /><span className="text-xs font-semibold uppercase">Payment by transfer</span></div>
          <h2 className="mt-2 text-xl font-bold">Choose a transfer method</h2>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-muted-foreground">Shipment total</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{props.amount}</p>
        </div>
      </header>

      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <div className="grid max-w-3xl gap-3 sm:grid-cols-3" role="group" aria-label="Payment method">
          {(["bank", "btc", "usdt"] as const).map((key) => (
            <Button key={key} type="button" variant="outline" aria-pressed={method === key}
              onClick={() => { setMethod(key); setRef(""); }}
              className={`h-16 justify-between rounded-md px-4 shadow-none hover:bg-muted hover:text-foreground ${method === key ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "bg-card text-muted-foreground"}`}>
              <span className="flex items-center gap-3">
                <span className={`flex size-8 items-center justify-center rounded-full text-lg font-semibold ${key === "bank" ? "bg-primary/10 text-primary" : key === "btc" ? "bg-accent/15 text-accent" : "bg-success/10 text-success"}`} aria-hidden="true">
                  {key === "bank" ? <Building2 className="size-4" /> : key === "btc" ? "₿" : "₮"}
                </span>
                <span className="text-left">
                  <span className="block text-sm font-semibold">{key === "bank" ? "Bank transfer" : key === "btc" ? "Bitcoin" : "USDT"}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">{key === "bank" ? "Pay from your bank" : key === "btc" ? "BTC" : "Tether"}</span>
                </span>
              </span>
              {method === key && <CheckCircle2 className="size-4" />}
            </Button>
          ))}
        </div>

        {method === "bank" ? (
          <div className="mt-8 rounded-md border border-line bg-background p-5 sm:p-6">
            <div className="flex items-center gap-2"><Building2 className="size-5 text-primary" /><h3 className="text-lg font-bold">Bank transfer details</h3></div>
            {isLoadingBankDetails ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading bank details…</p>
            ) : bankDetailsError || !hasBankDetails ? (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Bank details are not available right now. Please contact our team through Live chat before making a payment.</p>
            ) : (
              <dl className="mt-4 divide-y divide-line rounded-md border border-line">
                {bankRows.filter(([, value]) => value?.trim()).map(([label, value]) => (
                  <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
                    <dd className="break-all font-mono text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {transferDetails?.bankNote?.trim() && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{transferDetails.bankNote}</p>}
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Use your waybill number as the bank transfer reference: <span className="break-all font-semibold text-foreground">{props.tracking}</span></p>
          </div>
        ) : payment && (
          <div className="mt-8 grid items-center gap-6 sm:grid-cols-[216px_minmax(0,1fr)] sm:gap-8">
            <div className="mx-auto w-[216px] max-w-full text-center">
              <img src={payment.image} alt={`${payment.symbol} payment QR code`} width={216} height={216} className="aspect-square w-full object-contain" />
              <p className="mt-3 text-xs text-muted-foreground">{payment.symbol} payment address</p>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold">{payment.label} wallet</h3>
              <div className="mt-5 flex items-center justify-between gap-3">
                <label htmlFor="payment-wallet" className="text-xs font-semibold uppercase text-muted-foreground">Wallet address</label>
                <span className="text-xs font-semibold text-primary">{payment.symbol}</span>
              </div>
              <div className="mt-2 flex min-w-0 items-center gap-3 border border-line bg-muted/50 p-3">
                <p id="payment-wallet" className="min-w-0 flex-1 select-all break-all font-mono text-sm leading-6">{payment.address}</p>
                <Button type="button" variant="ghost" size="icon" onClick={() => void copyAddress()} title="Copy wallet address" aria-label="Copy wallet address" className="shrink-0 text-primary hover:bg-primary/10 hover:text-primary">
                  {copied === payment.address ? <Check /> : <Copy />}
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4 text-sm">
                <span className="text-muted-foreground">Waybill reference</span><span className="break-all font-semibold">{props.tracking}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Confirm the {payment.symbol} amount{method === "usdt" ? " and USDT network" : ""} with our team through Live chat before sending payment.</p>
            </div>
          </div>
        )}

        {props.submittedAt && (
          <div role="status" className="mt-7 flex items-start gap-3 border-l-2 border-primary bg-primary/5 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 text-sm"><p className="font-semibold">Payment submitted · awaiting verification</p><p className="mt-1 break-all text-muted-foreground">{props.submittedMethod?.toUpperCase()} · {props.submittedRef}</p></div>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="mt-8 border-t border-line pt-6">
          <label htmlFor="transfer-reference" className="text-sm font-semibold">{method === "bank" ? "Bank transfer reference" : "Transaction hash"}</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Input id="transfer-reference" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={method === "bank" ? "Enter your bank transfer reference" : "Paste your transaction hash"} maxLength={300} className="h-11 min-w-0 flex-1 bg-background shadow-none" />
            <Button type="submit" disabled={m.isPending || ref.trim().length < 3} className="h-11 shrink-0 px-5">{m.isPending ? "Submitting…" : "I've paid"}<ArrowUpRight /></Button>
          </div>
        </form>
      </div>
    </section>
  );
}
