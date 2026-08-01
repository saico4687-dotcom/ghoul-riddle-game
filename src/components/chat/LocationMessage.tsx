import { MapPin } from "lucide-react";

interface Props {
  lat: number;
  lng: number;
}

// بطاقة موقع بسيطة: بريفيو خريطة ثابت (OpenStreetMap، من غير أي مفتاح API)
// ورابط بيفتح الموقع بالتفصيل عند الضغط.
export default function LocationMessage({ lat, lng }: Props) {
  const zoom = 15;
  const delta = 0.01;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const previewUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lng}&layer=mapnik`;
  const openUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;

  return (
    <a
      href={openUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg overflow-hidden border border-white/20 bg-white/5 max-w-[240px]"
    >
      <iframe
        title="موقع مُشارك"
        src={previewUrl}
        className="w-full h-32 pointer-events-none"
        loading="lazy"
      />
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-white">
        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
        <span>موقع مُشارك — اضغط للفتح في الخريطة</span>
      </div>
    </a>
  );
}
