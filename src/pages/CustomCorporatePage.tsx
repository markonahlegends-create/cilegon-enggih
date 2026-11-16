import React, { useState } from 'react';
import {
  Building2,
  Calculator,
  CheckCircle2,
  Sparkles,
  FileText,
  Send,
  MessageCircle,
  ShieldCheck,
  Award,
  Layers
} from 'lucide-react';
import { formatRupiah, buildWhatsAppUrl } from '../data/products';
import { useStore } from '../context/StoreContext';

export const CustomCorporatePage: React.FC = () => {
  const { pushToast, products } = useStore();
  const [selectedProdId, setSelectedProdId] = useState<string>(''); // default: Tumbler Sporty (prod-7)
  const [quantity, setQuantity] = useState(50);
  const [addCustomLogo, setAddCustomLogo] = useState(true);
  const [addHardbox, setAddHardbox] = useState(false);

  // Inquiry Form State
  const [companyName, setCompanyName] = useState('');
  const [picName, setPicName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [submittedQuote, setSubmittedQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const selectedProd =
    products.find((p) => p.id === selectedProdId) ||
    products.find((p) => p.slug === 'tumbler-stainless-steel-sporty') ||
    products[0];

  // Tiered wholesale calculation
  const getTierDiscount = (qty: number) => {
    if (qty >= 250) return 0.25;
    if (qty >= 100) return 0.2;
    if (qty >= 50) return 0.16;
    if (qty >= 25) return 0.1;
    return 0;
  };

  const tierDiscount = getTierDiscount(quantity);
  const baseRetail = selectedProd.price;
  const discountedUnit = Math.round(baseRetail * (1 - tierDiscount));
  const logoFeePerUnit = addCustomLogo ? (quantity >= 100 ? 0 : 4000) : 0;
  const hardboxFeePerUnit = addHardbox ? 18000 : 0;

  const finalUnitPrice = discountedUnit + logoFeePerUnit + hardboxFeePerUnit;
  const totalEstimate = finalUnitPrice * quantity;
  const totalSavings = (baseRetail - discountedUnit) * quantity;

  const handleSubmitB2B = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/b2b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          picName,
          phone,
          email,
          eventDate,
          productName: selectedProd.name,
          quantity,
          addCustomLogo,
          addHardbox,
          estimatedTotal: totalEstimate,
          customNotes
        })
      });
      const data = await res.json();
      if (!res.ok || !data.inquiry) {
        pushToast(
          'Form Belum Lengkap',
          data?.error || 'Periksa nama instansi, PIC, dan nomor WhatsApp.',
          'warning'
        );
        return;
      }
      if (data.inquiry) {
        setSubmittedQuote(data.inquiry);
        pushToast(
          'Permintaan Penawaran B2B Terkirim!',
          `Nomor Referensi: ${data.inquiry.quoteId}`,
          'success'
        );
      }
    } catch {
      pushToast('Gagal Mengirim Form', 'Silakan klik tombol Konsultasi WhatsApp', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToWhatsApp = () => {
    const msg = `Halo Tim B2B Korporat Cilegon Enggih!\n\nKami ingin meminta penawaran resmi grosir/custom:\n• Instansi/Perusahaan: *${
      companyName || '-'
    }*\n• PIC: ${picName || '-'}\n• Produk Pilihan: *${
      selectedProd.name
    }*\n• Jumlah: *${quantity} pcs*\n• Custom Logo Instansi: ${
      addCustomLogo ? 'Ya (Cetak Logo Acara/Perusahaan)' : 'Tanpa Tambahan Logo'
    }\n• Upgrade Hardbox VIP: ${
      addHardbox ? 'Ya' : 'Kemasan Standar'
    }\n• Estimasi Simulasi Web: *${formatRupiah(
      totalEstimate
    )}* (${formatRupiah(finalUnitPrice)}/pcs)\n\nMohon info penawaran & mockup desainnya. Terima kasih!`;

    window.open(buildWhatsAppUrl(msg), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Hero B2B */}
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-forest-700 text-white p-6 sm:p-10 shadow-card-hover grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-amberbrand-300 text-xs font-bold uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" /> Divisi Custom & Korporat (B2B) Kota Cilegon
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight">
            Suvenir Resmi Industri, BUMN, Instansi Pemerintah & Seminar
          </h1>
          <p className="text-xs sm:text-base text-slate-200 leading-relaxed max-w-2xl">
            Sandingkan logo perusahaan atau acara Anda bersama ikon kebanggaan{' '}
            <strong>Landmark Simpang Tiga Cilegon</strong>. Dilengkapi layanan gratis
            desain mockup digital, dokumen penawaran resmi (Quotation/Invoice/Faktur),
            dan garansi ketepatan waktu produksi.
          </p>
        </div>

        <div className="lg:col-span-4 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 space-y-2.5 text-xs">
          <div className="font-extrabold text-amberbrand-300 uppercase tracking-wider">
            Keunggulan Pengadaan B2B Kami
          </div>
          {[
            'Gratis Tambah Logo Perusahaan min. 100 pcs',
            'Tersedia Sample Fisik Sebelum Produksi Massal',
            'Opsi Kemasan Hardbox Magnetik + Kartu VIP',
            'Pengiriman Prioritas Kawasan Industri Cilegon'
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-slate-100">
              <CheckCircle2 className="w-4 h-4 text-forest-300 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid: Left Live Wholesale Simulator + Right B2B Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Simulator Harga Grosir */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-soft space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-navy-50 text-navy-800 flex items-center justify-center">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-navy-800">
                Simulasi Harga Grosir & Kustomisasi
              </h2>
              <p className="text-xs text-slate-500">
                Hitung estimasi anggaran suvenir acara Anda secara transparan
              </p>
            </div>
          </div>

          {/* Product Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              1. Pilih Produk Merchandise / Paket Hampers:
            </label>
            <select
              value={selectedProdId}
              onChange={(e) => setSelectedProdId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-navy-800 focus:border-forest-600 outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Retail: {formatRupiah(p.price)})
                </option>
              ))}
            </select>
          </div>

          {/* Preview Selected */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-surface-warm border border-slate-200/70">
            <img
              src={selectedProd.image}
              alt={selectedProd.shortName}
              className="w-16 h-16 rounded-xl object-cover border border-slate-200"
            />
            <div>
              <div className="text-xs font-extrabold text-navy-800">
                {selectedProd.name}
              </div>
              <div className="text-[11px] text-slate-500">
                Harga Eceran: {formatRupiah(baseRetail)} / pcs
              </div>
            </div>
          </div>

          {/* Quantity Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                2. Jumlah Pemesanan (Kuantitas):
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={15}
                  max={2000}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(15, Number(e.target.value) || 15))}
                  className="w-20 px-2.5 py-1 rounded-lg border border-slate-300 text-right text-sm font-extrabold text-navy-800"
                />
                <span className="text-xs font-bold text-slate-500">pcs</span>
              </div>
            </div>
            <input
              type="range"
              min={15}
              max={500}
              step={5}
              value={Math.min(500, quantity)}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full accent-forest-600"
            />
            <div className="grid grid-cols-4 gap-2 text-[11px] text-center pt-1">
              {[
                { label: '25+ pcs', disc: 'Diskon 10%' },
                { label: '50+ pcs', disc: 'Diskon 16%' },
                { label: '100+ pcs', disc: 'Diskon 20% + Free Logo' },
                { label: '250+ pcs', disc: 'Diskon 25% VIP' }
              ].map((tier, idx) => (
                <div
                  key={idx}
                  className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600"
                >
                  <div className="font-extrabold text-navy-800">{tier.label}</div>
                  <div className="text-[10px] text-forest-700 font-semibold">{tier.disc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Logo & Hardbox Toggles */}
          <div className="space-y-2.5">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={addCustomLogo}
                onChange={(e) => setAddCustomLogo(e.target.checked)}
                className="mt-1 accent-forest-600"
              />
              <div className="text-xs">
                <div className="font-bold text-navy-800">
                  Tambah Cetak / Grafir Logo Instansi / Acara
                </div>
                <div className="text-slate-500">
                  {quantity >= 100
                    ? 'GRATIS biaya cetak logo untuk pemesanan ≥ 100 pcs!'
                    : '+ Rp 4.000 / pcs (Gratis jika memesan ≥ 100 pcs)'}
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={addHardbox}
                onChange={(e) => setAddHardbox(e.target.checked)}
                className="mt-1 accent-forest-600"
              />
              <div className="text-xs">
                <div className="font-bold text-navy-800">
                  Upgrade Kemasan Hardbox Eksklusif + Kartu Ucapan (+Rp 18.000/pcs)
                </div>
                <div className="text-slate-500">
                  Direkomendasikan untuk cendera mata pembicara & tamu VIP
                </div>
              </div>
            </label>
          </div>

          {/* Output Box */}
          <div className="rounded-2xl bg-navy-800 text-white p-5 space-y-2.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Harga Satuan Setelah Diskon Grosir ({Math.round(tierDiscount * 100)}%):</span>
              <strong className="text-white">{formatRupiah(finalUnitPrice)} / pcs</strong>
            </div>
            {totalSavings > 0 && (
              <div className="flex justify-between text-xs text-amberbrand-300">
                <span>Total Penghematan Anggaran:</span>
                <strong>Hemat {formatRupiah(totalSavings)}</strong>
              </div>
            )}
            <div className="pt-2.5 border-t border-white/15 flex items-baseline justify-between">
              <span className="text-xs sm:text-sm font-bold">
                Estimasi Total ({quantity} pcs):
              </span>
              <span className="text-2xl font-extrabold text-amberbrand-400">
                {formatRupiah(totalEstimate)}
              </span>
            </div>
          </div>
        </div>

        {/* Form Pemesanan Jumlah Besar (B2B) */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-soft space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-700 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-navy-800">
                Formulir Permintaan Penawaran Resmi (RFQ)
              </h2>
              <p className="text-xs text-slate-500">
                Tim Korporat Cilegon Enggih merespons dalam &lt; 1 jam kerja
              </p>
            </div>
          </div>

          {submittedQuote ? (
            <div className="p-6 rounded-2xl bg-forest-50 border border-forest-200 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-forest-600 mx-auto" />
              <div>
                <h3 className="text-base font-extrabold text-navy-800">
                  Permintaan Penawaran {submittedQuote.quoteId} Diterima!
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Terima kasih Bapak/Ibu <strong>{submittedQuote.picName}</strong> dari{' '}
                  <strong>{submittedQuote.companyName}</strong>. Proposal resmi sedang
                  disiapkan oleh tim kami.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleSendToWhatsApp}
                  className="px-4 py-2.5 rounded-xl bg-forest-600 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" /> Lanjut Diskusi Mockup di WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setSubmittedQuote(null)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                >
                  Buat Simulasi Baru
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitB2B} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Perusahaan / Instansi / Komunitas *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Mis. PT Krakatau Baja / Dinas Pariwisata"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap PIC / Pemesan *
                  </label>
                  <input
                    type="text"
                    required
                    value={picName}
                    onChange={(e) => setPicName(e.target.value)}
                    placeholder="Nama penanggung jawab"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor WhatsApp PIC *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Kantor (Untuk Kirim Quotation PDF)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="procurement@perusahaan.co.id"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Tanggal Acara / Deadline Pengiriman
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detail Kebutuhan Logo / Kombinasi Isi Hampers
                </label>
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Tuliskan posisi logo yang diinginkan, kombinasi warna pita, atau permintaan faktur pajak..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                />
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-xl bg-amberbrand-400 hover:bg-amberbrand-500 text-navy-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {loading
                      ? 'Mengirim Permintaan...'
                      : 'Ajukan Penawaran Resmi & Mockup Gratis'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSendToWhatsApp}
                  className="w-full py-3 px-5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Kirim Hasil Simulasi Ini ke WhatsApp Korporat</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
