import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "vi" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  vi: {
    // Top Bar
    "topbar.infra": "HẠ TẦNG GIÁM SÁT TOÀN DIỆN:",
    "topbar.active": "100% HOẠT ĐỘNG",
    "topbar.smoke": "LƯU LƯỢNG KHÓI:",
    "topbar.safe": "AN TOÀN",
    "topbar.warning": "CẢNH BÁO",
    "topbar.air": "CHẤT LƯỢNG KHÔNG KHÍ:",
    "topbar.good": "TỐT (AQI)",
    "topbar.moderate": "TRUNG BÌNH",
    "topbar.weather": "THỜI TIẾT:",
    "topbar.city": "TP. HỒ CHÍ MINH",
    "topbar.weather_desc": "Nắng nhẹ • Gió 8 km/h",
    "topbar.humidity": "ĐỘ ẨM:",

    // Header
    "nav.find": "Tìm Bãi Đỗ",
    "nav.map": "Sơ Đồ & Đặt Chỗ",
    "nav.solutions": "Giải Pháp",
    "nav.infrastructure": "Hạ Tầng",
    "nav.login": "Đăng Nhập",
    "nav.register": "Đăng Ký",
    "nav.vip": "Khách hàng VIP",
    "nav.logout": "Đăng xuất",

    // Hero
    "hero.badge": "MẠNG LƯỚI HẠ TẦNG GIÁM SÁT QUỐC GIA • LIVE TELEMETRY V4 URBAN MOBILITY ENGINE",
    "hero.title_part1": "Tìm Chỗ Đỗ Xe Thông Minh,",
    "hero.title_part2": "Nhanh",
    "hero.title_part3": "Chóng & Chuẩn Xác",
    "hero.desc": "Khám phá các bãi đỗ xe gần bạn, kiểm tra tình trạng chỗ trống theo thời gian thực và đặt trước vị trí với công nghệ IoT, GIS và ANPR.",
    "search.destination": "CỬA ĐIỂM CẦN ĐẾN",
    "search.destination_val": "Quận 1, TP. Hồ Chí Minh",
    "search.time": "THỜI GIAN ĐẾN",
    "search.time_val": "Hôm nay, 14:00 - 17:00",
    "search.vehicle": "LOẠI PHƯƠNG TIỆN",
    "search.vehicle_val": "Ô tô 4 - 7 chỗ",
    "search.submit": "Tìm Bãi Đỗ Xe",
    "search.filter_label": "Bộ lọc nhanh:",
    "filter.near": "Gần tôi",
    "filter.available": "Còn chỗ trống",
    "filter.best_price": "Giá tốt nhất",
    "filter.has_charge": "Có chỗ sạc",
    "filter.ev": "Trạm sạc EV",
    "filter.open_247": "Mở cửa 24/7",
    "filter.car_type": "Ô tô 4-7 chỗ",
    "hero.trust_1": "Chứng nhận ANPR chuẩn Quốc gia",
    "hero.trust_2": "Bàn giao lưới thời gian thực GiST/Spatial",
    "hero.trust_3": "Tự động thanh toán chạm & đi Mobile",

    // Stats
    "stat.facilities": "TỔNG CƠ SỞ",
    "stat.facilities_sub": "Bãi đỗ xe đối tác",
    "stat.facilities_desc": "Đồng bộ liên tục qua mạng IoT GIS",
    "stat.facilities_link": "Phủ khắp 63 tỉnh thành | TOÀN QUỐC →",
    "stat.accuracy": "ĐỘ CHÍNH XÁC",
    "stat.accuracy_sub": "Độ chính xác cảm biến",
    "stat.accuracy_desc": "Cảm biến kép Siêu âm & Từ trường",
    "stat.accuracy_link": "Xác minh độ rộng | ĐỘ RỘNG →",
    "stat.traffic": "LƯU LƯỢNG NGÀY",
    "stat.traffic_sub": "Lượt gửi xe / ngày",
    "stat.traffic_desc": "Lưu lượng phương tiện gửi/rút",
    "stat.traffic_link": "Giám sát 450 Trung tâm thương mại | HIỆN TẠI →",
    "stat.auto": "QUY TRÌNH TỰ ĐỘNG",
    "stat.auto_sub": "Tự động hóa số",
    "stat.auto_desc": "Không dừng ANPR Barie mở <0.3s",
    "stat.auto_link": "AI Edge xử lý tại chỗ 50ms | TỰ ĐỘNG XỬ LÝ →",

    // GIS
    "gis.hub": "SPATIAL TELEMETRY HUB",
    "gis.title": "Trung Tâm Bản Đồ Không Gian GIS",
    "gis.desc": "Mạng lưới định vị vệ tinh và vận hành toàn bãi xe thời gian thực TP. Hồ Chí Minh",
    "gis.map": "Bản đồ",
    "gis.satellite": "Vệ tinh",
    "gis.3d": "Lớp 3D",
    "gis.hub_title": "Khu Vực 1 Quận 1",
    "gis.hub_open": "Tổng số chỗ đang mở:",
    "gis.hub_open_val": "62 điểm",
    "gis.hub_avail": "Chỗ trống thực tế:",
    "gis.hub_avail_val": "887 chỗ",
    "gis.hub_fill": "Mức độ lấp đầy:",
    "gis.legend": "Hiển thị nhanh:",
    "gis.legend_green": "Còn chỗ (>20)",
    "gis.legend_yellow": "Sắp đầy (1-19)",
    "gis.legend_red": "Hết chỗ (0)",
    "gis.legend_cyan": "Trạm EV",
    "gis.user_pos": "Vị trí của bạn",
    "gis.pin1_name": "SAIGON CENTRE",
    "gis.pin1_tag": "125 chỗ trống",
    "gis.pin2_name": "SKYVIEW GRAND TOWER",
    "gis.pin2_tag": "64 chỗ trống",
    "gis.pin3_name": "NHÀ BÈ ĐỒNG DIỄN",
    "gis.pin3_tag": "Mất kết nối",
    "gis.pin3_desc": "100% Tải trọng · Tạm ngừng nhận · 15 chỗ trống chờ xe",
    "gis.view_detail": "Chi tiết →",
    "gis.api_empty": "Dữ liệu API chưa khả dụng",
    "gis.api_syncing": "Đang đồng bộ dữ liệu bãi đỗ...",

    // Solutions
    "sol.tag": "CÔNG NGHỆ ĐIỀU PHỐI ĐÔ THỊ",
    "sol.title": "Giải Pháp Toàn Diện Cho Đô Thị Thông Minh",
    "sol.desc": "Số hóa toàn bộ quy trình gửi xe từ tìm kiếm, dẫn đường, giữ chỗ cho tới nhận diện biển số tự động và thanh toán không tiền mặt.",
    "sol.s1_title": "Tình Trạng Chỗ Theo Thời Gian Thực",
    "sol.s1_desc": "Cảm biến siêu âm gắn trực tiếp tại tầng ô đỗ xe truyền dữ liệu trực tuyến về gateway IoT kết nối 2 giây/lần qua mạng LoRaWAN/Mesh.",
    "sol.s1_tag": "Cảm biến kép Dual-Sensor",
    "sol.s2_title": "Đặt Trước Vị Trí Đỗ Xe",
    "sol.s2_desc": "Khóa giữ chỗ tự động xem trước 60 phút trước khi đến nơi. Tự động nhận diện khoảng cách xe di chuyển và hoàn tiền linh hoạt nếu hủy chuyến.",
    "sol.s2_tag": "Đảm bảo vị trí chuẩn xác",
    "sol.s3_title": "Thanh Toán Đa Phương Thức",
    "sol.s3_desc": "Hỗ trợ quét nạp qua MoMo, VNPAY, Viettel Money, thẻ quốc tế Visa/MasterCard và ParkMatrix QuickPay tự động trừ tiền khi nhận diện biển số ra cổng.",
    "sol.s3_tag": "Không dừng tốn một giây",
    "sol.s4_title": "Tự Động Nhận Diện Biển Số (ANPR)",
    "sol.s4_desc": "Thuật toán Deep Learning nhận diện kể cả chuẩn biển số mờ/bẩn trong mọi điều kiện ánh sáng, góc nghiêng hay mưa gió. Barie mở tự động dưới 0.3s.",
    "sol.s4_tag": "Edge AI Camera tốc độ cao",
    "sol.s5_title": "Quản Lý Đa Phương Tiện & EV",
    "sol.s5_desc": "Định vị phân luồng riêng cho ô tô/xe điện/xe máy/trạm sạc AC/DC, và đồng bộ dòng xe đến/đi, điều hướng dễ dàng không lo tắc nghẽn.",
    "sol.s5_tag": "Tích hợp trụ sạc nhanh",
    "sol.s6_title": "Lịch Sử & Hóa Đơn Điện Tử",
    "sol.s6_desc": "Tự động xuất hóa đơn GTGT điện tử chuẩn Tổng cục Thuế ngay khi thanh toán, dễ dàng tra cứu lịch sử hành trình và xuất báo cáo đề xuất.",
    "sol.s6_tag": "Chuẩn hóa hóa đơn điện tử",

    // CTA
    "cta.badge": "HỆ THỐNG ĐIỀU PHỐI SỐ THÔNG MINH",
    "cta.title": "Sẵn sàng nâng tầm trải nghiệm đỗ xe thông minh cùng ParkMatrix?",
    "cta.desc": "Kết nối trực tiếp vào mạng lưới hạ tầng điều phối thông minh, loại bỏ hoàn toàn nỗi lo kẹt xe tìm chỗ tại các khu trung tâm thương mại và đô thị phức hợp.",
    "cta.metric_latency": "Độ trễ lệnh:",
    "cta.metric_uptime": "Thời gian Uptime:",
    "cta.metric_interval": "Định kỳ cập nhật:",
    "cta.btn_book": "📱 Đặt Chỗ Ngay",
    "cta.btn_gis": "🛠 Tìm Hiểu Công Nghệ GIS",

    // Footer
    "footer.desc": "Nền tảng quản lý bãi đỗ xe thông minh, đa cơ sở hàng đầu Việt Nam. Tích hợp IoT, AI ANPR và bản đồ số GIS thời gian thực.",
    "footer.support": "Trung Tâm Hỗ Trợ",
    "footer.privacy": "Chính sách bảo mật",
    "footer.terms": "Điều khoản dịch vụ",
    "footer.rights": "Bản quyền thuộc về ParkMatrix Corporation. Mọi quyền được bảo lưu.",
  },
  en: {
    // Top Bar
    "topbar.infra": "NATIONAL MONITORING INFRASTRUCTURE:",
    "topbar.active": "100% OPERATIONAL",
    "topbar.smoke": "SMOKE DENSITY:",
    "topbar.safe": "SAFE",
    "topbar.warning": "WARNING",
    "topbar.air": "AIR QUALITY:",
    "topbar.good": "GOOD (AQI)",
    "topbar.moderate": "MODERATE",
    "topbar.weather": "WEATHER:",
    "topbar.city": "HO CHI MINH CITY",
    "topbar.weather_desc": "Partly Cloudy • Wind 8 km/h",
    "topbar.humidity": "HUMIDITY:",

    // Header
    "nav.find": "Find Parking",
    "nav.map": "Map & Booking",
    "nav.solutions": "Solutions",
    "nav.infrastructure": "Infrastructure",
    "nav.login": "Log In",
    "nav.register": "Register",
    "nav.vip": "VIP Customer",
    "nav.logout": "Log Out",

    // Hero
    "hero.badge": "NATIONAL SURVEILLANCE INFRASTRUCTURE • LIVE TELEMETRY V4 URBAN MOBILITY ENGINE",
    "hero.title_part1": "Find Smart Parking Spots,",
    "hero.title_part2": "Fast",
    "hero.title_part3": "& Accurate",
    "hero.desc": "Discover parking lots near you, check live slot availability in real time, and reserve your spot powered by IoT, GIS, and ANPR technology.",
    "search.destination": "DESTINATION LOCATION",
    "search.destination_val": "District 1, Ho Chi Minh City",
    "search.time": "ARRIVAL TIME",
    "search.time_val": "Today, 14:00 - 17:00",
    "search.vehicle": "VEHICLE TYPE",
    "search.vehicle_val": "Sedan & SUV 4 - 7 Seats",
    "search.submit": "Search Parking",
    "search.filter_label": "Quick filters:",
    "filter.near": "Near me",
    "filter.available": "Available now",
    "filter.best_price": "Best price",
    "filter.has_charge": "EV charging",
    "filter.ev": "Fast DC Charger",
    "filter.open_247": "Open 24/7",
    "filter.car_type": "4-7 Seats Car",
    "hero.trust_1": "National Certified ANPR Standard",
    "hero.trust_2": "Real-time GiST/Spatial Grid Dispatch",
    "hero.trust_3": "Tap & Go Mobile Frictionless Pay",

    // Stats
    "stat.facilities": "TOTAL FACILITIES",
    "stat.facilities_sub": "Partner Parking Hubs",
    "stat.facilities_desc": "Real-time sync via IoT GIS Network",
    "stat.facilities_link": "Across 63 Provinces | NATIONWIDE →",
    "stat.accuracy": "ACCURACY",
    "stat.accuracy_sub": "Dual-sensor Precision",
    "stat.accuracy_desc": "Ultrasonic & Geomagnetic Fusion",
    "stat.accuracy_link": "Slot dimension check | SPACING →",
    "stat.traffic": "DAILY TRAFFIC",
    "stat.traffic_sub": "Check-ins / Day",
    "stat.traffic_desc": "Continuous in/out vehicle telemetry",
    "stat.traffic_link": "Monitoring 450 Commercial Malls | LIVE →",
    "stat.auto": "AUTOMATION RATE",
    "stat.auto_sub": "Digital Automation",
    "stat.auto_desc": "Non-stop ANPR Barrier Opening <0.3s",
    "stat.auto_link": "Edge AI local inferencing 50ms | AUTO →",

    // GIS
    "gis.hub": "SPATIAL TELEMETRY HUB",
    "gis.title": "GIS Spatial Map Center",
    "gis.desc": "Satellite positioning and full-scale real-time parking operations network in Ho Chi Minh City",
    "gis.map": "Map",
    "gis.satellite": "Satellite",
    "gis.3d": "3D Layer",
    "gis.hub_title": "Sector 1 District 1",
    "gis.hub_open": "Total active facilities:",
    "gis.hub_open_val": "62 hubs",
    "gis.hub_avail": "Real-time available slots:",
    "gis.hub_avail_val": "887 slots",
    "gis.hub_fill": "Occupancy rate:",
    "gis.legend": "Legend:",
    "gis.legend_green": "Available (>20)",
    "gis.legend_yellow": "Filling up (1-19)",
    "gis.legend_red": "Full (0)",
    "gis.legend_cyan": "EV Station",
    "gis.user_pos": "Your Location",
    "gis.pin1_name": "SAIGON CENTRE",
    "gis.pin1_tag": "125 available slots",
    "gis.pin2_name": "SKYVIEW GRAND TOWER",
    "gis.pin2_tag": "64 available slots",
    "gis.pin3_name": "NHA BE DONG DIEN",
    "gis.pin3_tag": "Disconnected",
    "gis.pin3_desc": "100% Load · Suspended · 15 slots holding",
    "gis.view_detail": "Details →",
    "gis.api_empty": "API data not available",
    "gis.api_syncing": "Syncing parking facilities data...",

    // Solutions
    "sol.tag": "URBAN MOBILITY DISPATCH TECH",
    "sol.title": "Comprehensive Smart Urban Mobility Solutions",
    "sol.desc": "Digitize entire parking workflows from search, navigation, reservation, to automatic plate recognition and contactless checkout.",
    "sol.s1_title": "Real-Time Slot Availability",
    "sol.s1_desc": "Ultrasonic sensors mounted directly above each bay transmit live occupancy to IoT gateways every 2s via LoRaWAN/Mesh.",
    "sol.s1_tag": "Dual-Sensor Precision",
    "sol.s2_title": "Advanced Parking Spot Reservation",
    "sol.s2_desc": "Automated spot lock 60 mins before arrival. Proximity tracking with instant refunds on cancellation.",
    "sol.s2_tag": "Guaranteed Bay Allocation",
    "sol.s3_title": "Multi-Modal Frictionless Payment",
    "sol.s3_desc": "Support MoMo, VNPAY, Viettel Money, Visa/MasterCard, and ParkMatrix QuickPay automatic exit deduction upon plate scan.",
    "sol.s3_tag": "Zero Waiting Time",
    "sol.s4_title": "Automated Number Plate Recognition (ANPR)",
    "sol.s4_desc": "Deep Learning OCR recognizes blurry or tilted plates in harsh rain/night conditions. Barriers trigger under 0.3s.",
    "sol.s4_tag": "High-Speed Edge AI Camera",
    "sol.s5_title": "Multi-Vehicle & EV Fleet Management",
    "sol.s5_desc": "Dedicated zoning for sedans, SUVs, bikes, and AC/DC fast chargers. Prevents bottlenecks with predictive flow routing.",
    "sol.s5_tag": "EV Charging Integrated",
    "sol.s6_title": "Digital Invoicing & Audit Trails",
    "sol.s6_desc": "Automated e-invoices compliant with tax authorities issued immediately after checkout with full transparent history.",
    "sol.s6_tag": "Standardized E-Invoice",

    // CTA
    "cta.badge": "SMART DIGITAL DISPATCH PLATFORM",
    "cta.title": "Ready to upgrade your parking experience with ParkMatrix?",
    "cta.desc": "Connect directly to the intelligent infrastructure network and eliminate urban parking congestion today.",
    "cta.metric_latency": "Command latency:",
    "cta.metric_uptime": "Platform Uptime:",
    "cta.metric_interval": "Update frequency:",
    "cta.btn_book": "📱 Reserve Now",
    "cta.btn_gis": "🛠 Explore GIS Tech",

    // Footer
    "footer.desc": "Vietnam's leading multi-facility smart parking platform. Seamlessly integrated with IoT, AI ANPR, and real-time GIS mapping.",
    "footer.support": "Support Center",
    "footer.privacy": "Privacy Policy",
    "footer.terms": "Terms of Service",
    "footer.rights": "Copyright © ParkMatrix Corporation. All rights reserved.",
  },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "vi",
  setLang: () => {},
  toggleLang: () => {},
  t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("parking.language");
    return saved === "en" || saved === "vi" ? saved : "vi";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("parking.language", newLang);
  };

  const toggleLang = () => {
    setLang(lang === "vi" ? "en" : "vi");
  };

  const t = (key: string): string => {
    return translations[lang][key] || translations["vi"][key] || key;
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
