import { Check } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export default function BookingSteps({ current }: { current: 1 | 2 | 3 }) {
  const { lang } = useLanguage();
  const isEn = lang === "en";
  const steps = isEn
    ? ["Find parking", "Select spot", "Payment"]
    : ["Tìm bãi", "Chọn chỗ", "Thanh toán"];

  return (
    <ol className="booking-steps" aria-label={isEn ? "Booking steps" : "Các bước đặt chỗ"}>
      {steps.map((label, index) => (
        <li key={index} className={index + 1 === current ? "is-current" : index + 1 < current ? "is-complete" : ""}
          aria-current={index + 1 === current ? "step" : undefined}>
          <span>{index + 1 < current ? <Check size={14} aria-hidden="true" /> : index + 1}</span>{label}
        </li>
      ))}
    </ol>
  );
}
