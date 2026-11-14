import { Check } from "lucide-react";

export default function BookingSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="booking-steps" aria-label="Các bước đặt chỗ">
      {["Tìm bãi", "Chọn chỗ", "Thanh toán"].map((label, index) => (
        <li key={label} className={index + 1 === current ? "is-current" : index + 1 < current ? "is-complete" : ""}
          aria-current={index + 1 === current ? "step" : undefined}>
          <span>{index + 1 < current ? <Check size={14} aria-hidden="true" /> : index + 1}</span>{label}
        </li>
      ))}
    </ol>
  );
}
