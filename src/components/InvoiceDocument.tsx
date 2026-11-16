import React, { useState } from 'react';
import { Printer, X, Package, Receipt, Truck } from 'lucide-react';
import { formatRupiah, STORE_DOMAIN } from '../data/products';
import { useStore } from '../context/StoreContext';

export interface InvoiceOrder {
  orderId: string;
  invoiceNumber?: string;
  createdAt?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  fullAddress?: string;
  addressDetail?: string;
  destination?: string;
  courier?: string;
  courierService?: string;
  resi?: string | null;
  paymentMethod?: string;
  paymentStatus?: string;
  status?: string;
  items: { name: string; qty: number; price: number }[];
  subtotal?: number;
  shippingCost?: number;
  voucherCode?: string | null;
  voucherDiscount?: number;
  uniqueCodeValue?: number;
  uniqueCode?: number;
  totalAmount: number;
  notes?: string;
  isPreOrder?: boolean;
  preOrderNote?: string;
  timeline?: any[];
}

interface InvoiceDocumentProps {
  order: InvoiceOrder;
  mode?: 'invoice' | 'label';
  onClose: () => void;
}

const formatDate = (iso?: string) => {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

/**
 * Dokumen cetak (Invoice A4 / Label Pengiriman A6) — 100% CSS print,
 * tanpa dependency PDF supaya tetap ringan & open-source.
 */
export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({
  order,
  mode: initialMode = 'invoice',
  onClose
}) => {
  const { settings } = useStore();
  const [mode, setMode] = useState<'invoice' | 'label'>(initialMode);

  const subtotal =
    order.subtotal ?? order.items.reduce((s, it) => s + it.price * it.qty, 0);
  const shipping = order.shippingCost ?? 0;
  const discount = order.voucherDiscount ?? 0;
  const unique = order.uniqueCodeValue ?? order.uniqueCode ?? 0;
  const total = order.totalAmount;

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto print:static print:overflow-visible">
      <div
        className="fixed inset-0 bg-navy-950/60 backdrop-blur-xs print:hidden"
        onClick={onClose}
      />

      <div className="relative z-10 mx-auto my-4 sm:my-8 w-full max-w-4xl px-2 sm:px-6 print:my-0 print:max-w-none print:px-0">
        {/* Toolbar */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-2 mb-3 bg-white rounded-2xl border border-slate-200 p-2.5 shadow-soft">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMode('invoice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                mode === 'invoice'
                  ? 'bg-navy-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> Invoice
            </button>
            <button
              type="button"
              onClick={() => setMode('label')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                mode === 'label'
                  ? 'bg-forest-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Label Pengiriman
            </button>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-amberbrand-400 hover:bg-amberbrand-500 text-navy-950 text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak / Simpan PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable sheet */}
        <div className="print-sheet bg-white rounded-2xl print:rounded-none shadow-xl print:shadow-none border border-slate-200 print:border-0 p-6 sm:p-10 text-slate-800">
          {mode === 'invoice' ? (
            <>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-navy-800">
                <div className="space-y-1">
                  <div className="text-xl font-extrabold text-navy-800 tracking-tight">
                    CILEGON ENGGIH
                  </div>
                  <div className="text-[11px] font-semibold text-forest-700 uppercase tracking-wider">
                    {settings.legalName} • Official Merchandise Store
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed max-w-xs">
                    {settings.address}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {settings.whatsappDisplay} • {settings.email} • www.{STORE_DOMAIN}
                  </div>
                </div>
                <div className="text-left sm:text-right space-y-0.5">
                  <div className="text-lg font-extrabold text-navy-800">INVOICE</div>
                  <div className="text-[11px] text-slate-600">
                    No: <strong className="text-slate-800">{order.invoiceNumber || order.orderId}</strong>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Order: <strong className="text-slate-800">{order.orderId}</strong>
                  </div>
                  <div className="text-[11px] text-slate-600">Tanggal: {formatDate(order.createdAt)}</div>
                  <div className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-forest-100 text-forest-800">
                    {order.paymentStatus || 'MENUNGGU_VERIFIKASI'}
                  </div>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    Dikirim Kepada
                  </div>
                  <div className="text-sm font-bold text-navy-800">{order.customerName}</div>
                  <div className="text-[11px] text-slate-600">{order.customerPhone}</div>
                  {order.customerEmail && order.customerEmail !== '-' && (
                    <div className="text-[11px] text-slate-600 break-all">{order.customerEmail}</div>
                  )}
                  <div className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                    {order.fullAddress ||
                      `${order.addressDetail ? `${order.addressDetail}, ` : ''}${order.destination || ''}`}
                  </div>
                </div>
                <div className="sm:text-right">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    Pengiriman
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    {order.courierService || order.courier || '-'}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Resi: <strong>{order.resi || 'Menunggu input resi kurir'}</strong>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Metode bayar: {order.paymentMethod || '-'}
                  </div>
                  <div className="text-[11px] text-slate-600">Status: {order.status || '-'}</div>
                </div>
              </div>

              {/* Items table */}
              <table className="w-full text-[11px] border border-slate-200">
                <thead className="bg-navy-800 text-white">
                  <tr>
                    <th className="text-left px-2.5 py-2 font-bold">Produk</th>
                    <th className="text-center px-2 py-2 font-bold w-14">Qty</th>
                    <th className="text-right px-2 py-2 font-bold w-28">Harga</th>
                    <th className="text-right px-2.5 py-2 font-bold w-32">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx} className={idx % 2 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="px-2.5 py-1.5 border-t border-slate-200">{item.name}</td>
                      <td className="px-2 py-1.5 border-t border-slate-200 text-center">{item.qty}</td>
                      <td className="px-2 py-1.5 border-t border-slate-200 text-right">
                        {formatRupiah(item.price)}
                      </td>
                      <td className="px-2.5 py-1.5 border-t border-slate-200 text-right font-semibold">
                        {formatRupiah(item.price * item.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4">
                <div className="text-[10px] text-slate-500 leading-relaxed max-w-xs space-y-1">
                  {order.isPreOrder && (
                    <div className="mt-1.5 px-2 py-1 rounded border border-forest-600/40 bg-forest-50 text-[9.5px] font-bold text-forest-800">
                      PRE-ORDER — {order.preOrderNote || '7–15 hari kerja setelah pembayaran diverifikasi'}
                    </div>
                  )}
                  {order.notes && (
                    <div>
                      <strong className="text-slate-700">Catatan:</strong> {order.notes}
                    </div>
                  )}
                  <div>{settings.invoice.footerNote}</div>
                  <div className="pt-1">
                    Barang dikirim dari {settings.addressShort} — {settings.originPostal}.
                  </div>
                </div>
                <div className="w-full sm:w-64 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal</span>
                    <span>{formatRupiah(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Ongkos Kirim</span>
                    <span>{formatRupiah(shipping)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-forest-700">
                      <span>Voucher {order.voucherCode || ''}</span>
                      <span>-{formatRupiah(discount)}</span>
                    </div>
                  )}
                  {unique > 0 && (
                    <div className="flex justify-between text-amberbrand-700">
                      <span>Kode Unik</span>
                      <span>{unique}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t-2 border-navy-800 pt-1.5 mt-1 text-sm font-extrabold text-navy-800">
                    <span>TOTAL</span>
                    <span>{formatRupiah(total)}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 text-right pt-1">
                    Mohon transfer tepat {formatRupiah(total)} agar verifikasi otomatis
                  </div>
                </div>
              </div>

              {/* Signature */}
              <div className="flex justify-between items-end pt-8 mt-4 border-t border-dashed border-slate-300">
                <div className="text-[10px] text-slate-500">
                  Invoice ini sah dan diterbitkan secara elektronik oleh sistem Cilegon Enggih.
                  <br />
                  Pertanyaan? WhatsApp {settings.whatsappDisplay} atau email {settings.email}.
                </div>
                <div className="text-center text-[10px]">
                  <div className="text-slate-500">Hormat kami,</div>
                  <div className="h-10" />
                  <div className="font-bold text-slate-800 border-t border-slate-400 pt-1 px-4">
                    {settings.invoice.signerName}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-center text-[9px] text-slate-400">
                {settings.developerTitle} — {settings.developerUrl}
              </div>
            </>
          ) : (
            <>
              {/* Shipping Label A6 */}
              <div className="border-4 border-navy-800 rounded-xl overflow-hidden">
                <div className="bg-navy-800 text-white px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <span className="text-xs font-extrabold tracking-wide">
                      CILEGON ENGGIH • LABEL PENGIRIMAN
                    </span>
                  </div>
                  <span className="text-[10px] font-bold">{settings.originCity.toUpperCase()}</span>
                </div>

                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] border-b border-dashed border-slate-300 pb-1.5">
                    <div>
                      <div className="text-[9px] uppercase text-slate-500 font-bold">Ekspedisi</div>
                      <div className="font-extrabold text-slate-800">
                        {order.courierService || order.courier || '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] uppercase text-slate-500 font-bold">No. Resi / AWB</div>
                      <div className="font-extrabold text-base tracking-wide text-navy-800">
                        {order.resi || '— MENUNGGU INPUT —'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="border border-slate-200 rounded p-1.5">
                      <div className="text-[8px] uppercase font-bold text-slate-500">Penerima</div>
                      <div className="font-bold text-slate-800 text-[11px]">{order.customerName}</div>
                      <div className="text-slate-600">{order.customerPhone}</div>
                      <div className="text-slate-600 leading-snug mt-0.5">
                        {order.fullAddress || order.addressDetail || order.destination}
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded p-1.5">
                      <div className="text-[8px] uppercase font-bold text-slate-500">Pengirim</div>
                      <div className="font-bold text-slate-800 text-[11px]">Cilegon Enggih</div>
                      <div className="text-slate-600">{settings.whatsappDisplay}</div>
                      <div className="text-slate-600 leading-snug mt-0.5">{settings.address}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] border-t border-dashed border-slate-300 pt-1.5">
                    <div>
                      <span className="text-slate-500">Order: </span>
                      <strong>{order.orderId}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Total: </span>
                      <strong>{formatRupiah(total)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Qty: </span>
                      <strong>{order.items.reduce((s, it) => s + it.qty, 0)} pcs</strong>
                    </div>
                  </div>

                  {order.isPreOrder && (
                    <div className="mt-1.5 px-2 py-1 rounded border border-forest-600/40 bg-forest-50 text-[9.5px] font-bold text-forest-800">
                      PRE-ORDER — {order.preOrderNote || '7–15 hari kerja setelah pembayaran diverifikasi'}
                    </div>
                  )}
                  {order.notes && (
                    <div className="text-[9px] bg-amberbrand-50 border border-amberbrand-200 rounded p-1.5 text-amberbrand-900">
                      Catatan: {order.notes}
                    </div>
                  )}

                  <div className="text-center text-[8px] text-slate-500 pt-1">
                    Fragile — Barang pecah belah. Jangan diinjak/dilipat. • {settings.addressShort}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
