import React, { useEffect, useState } from 'react';
import { Truck, MapPin, Zap, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { formatRupiah } from '../data/products';
import { useStore } from '../context/StoreContext';

interface ShippingService {
  id: string;
  courier: string;
  badge: string;
  type: string;
  eta: string;
  cost: number;
}

interface ShippingZone {
  id: string;
  label: string;
  allowInstant: boolean;
}

interface ShippingCalculatorProps {
  weightGrams?: number;
  compact?: boolean;
  onSelectService?: (service: ShippingService, zoneLabel: string) => void;
  selectedServiceId?: string;
}

export const ShippingCalculator: React.FC<ShippingCalculatorProps> = ({
  weightGrams = 350,
  compact = false,
  onSelectService,
  selectedServiceId
}) => {
  const { selectedZoneId, setSelectedZoneId } = useStore();
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [services, setServices] = useState<ShippingService[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/shipping/zones')
      .then((r) => r.json())
      .then((data) => {
        if (data.zones) setZones(data.zones);
      })
      .catch(() => {
        setZones([
          { id: 'cilegon-pusat', label: 'Kota Cilegon (Jombang, Purwakarta, Cibeber)', allowInstant: true },
          { id: 'serang', label: 'Kota Serang & Kab. Serang', allowInstant: true },
          { id: 'jakarta', label: 'DKI Jakarta', allowInstant: false },
          { id: 'bandung-jabar', label: 'Bandung & Jawa Barat', allowInstant: false }
        ]);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch('/api/shipping/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinationId: selectedZoneId,
        weightGrams
      })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.services) {
          setServices(data.services);
          if (onSelectService && data.services.length > 0) {
            const match =
              data.services.find((s: ShippingService) => s.id === selectedServiceId) ||
              data.services[0];
            onSelectService(match, data.destination);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedZoneId, weightGrams]);

  const activeZoneLabel =
    zones.find((z) => z.id === selectedZoneId)?.label || 'Kota Cilegon';

  return (
    <div className="rounded-2xl border border-slate-200 bg-surface-warm/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-forest-100 text-forest-700 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-navy-800">
              Kalkulator Ongkir Otomatis
            </h4>
            <p className="text-[11px] text-slate-500">
              Dikirim dari Kel. Karang Asem, Kec. Cibeber, Kota Cilegon ({Math.max(1, Math.ceil(weightGrams / 1000))} kg / {weightGrams} gr)
            </p>
          </div>
        </div>
        {loading && <RefreshCw className="w-4 h-4 text-forest-600 animate-spin" />}
      </div>

      {/* Destination Selector */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
          <MapPin className="w-3 h-3 inline mr-1 text-forest-600" />
          Pilih Kota / Area Tujuan Pengiriman:
        </label>
        <select
          value={selectedZoneId}
          onChange={(e) => setSelectedZoneId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 focus:border-forest-600 outline-none"
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))}
        </select>
      </div>

      {/* Courier Rates List */}
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {services.map((srv) => {
          const isSelected = selectedServiceId === srv.id;
          const isInstant = srv.type === 'Instan' || srv.type === 'Same Day';
          return (
            <div
              key={srv.id}
              onClick={() => onSelectService && onSelectService(srv, activeZoneLabel)}
              className={`rounded-xl p-2.5 border transition-all flex items-center justify-between gap-2 ${
                onSelectService ? 'cursor-pointer' : ''
              } ${
                isSelected
                  ? 'bg-forest-50 border-forest-600 ring-1 ring-forest-600/30'
                  : 'bg-white border-slate-200/80 hover:border-forest-400'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {srv.courier}
                  </span>
                  {isInstant && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amberbrand-100 text-amberbrand-800 text-[10px] font-bold shrink-0">
                      <Zap className="w-2.5 h-2.5" /> {srv.badge}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-400" /> Estimasi {srv.eta}
                </div>
              </div>
              <div className="text-right shrink-0 flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-extrabold text-navy-800">
                  {formatRupiah(srv.cost)}
                </span>
                {onSelectService && isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-forest-600" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
